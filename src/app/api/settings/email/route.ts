import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendViaResend, sendViaGmail, sendViaSES, refreshGmailToken } from '@/lib/emailService';

export const EmailSettingsSchema = z.object({
  action: z.string().optional(),
  provider: z.string().optional(),
  fromEmail: z.string().optional(),
  fromName: z.string().optional(),
  resendApiKey: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ep = await prisma.emailProvider.findUnique({ where: { userId } });
  if (!ep) return NextResponse.json({ configured: false });

  return NextResponse.json({
    configured: true,
    provider: ep.provider,
    fromEmail: ep.fromEmail,
    fromName: ep.fromName,
    hasApiKey: !!ep.resendApiKey,
  });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = EmailSettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const { action } = body;

  // Disconnect
  if (action === 'disconnect') {
    await prisma.emailProvider.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
  }

  // Test with current saved config
  if (action === 'test') {
    const ep = await prisma.emailProvider.findUnique({ where: { userId } });
    if (!ep) return NextResponse.json({ error: 'No email provider configured' }, { status: 400 });

    if (ep.provider === 'ses') {
      const result = await sendViaSES(ep.fromName, ep.fromEmail, {
        to: ep.fromEmail,
        donorName: 'Test Donor',
        orgName: ep.fromName,
        totalAmount: 100,
        dateRange: 'Test',
      });
      return NextResponse.json(result);
    }

    if (ep.provider === 'resend' && ep.resendApiKey) {
      const result = await sendViaResend(ep.resendApiKey, ep.fromEmail, ep.fromName, {
        to: ep.fromEmail,
        donorName: 'Test Donor',
        orgName: ep.fromName,
        totalAmount: 100,
        dateRange: 'Test',
      });
      return NextResponse.json(result);
    }

    if (ep.provider === 'gmail' && ep.accessToken) {
      const fiveMinutes = 5 * 60 * 1000;
      const isExpired = !ep.tokenExpiry || ep.tokenExpiry.getTime() - Date.now() < fiveMinutes;
      let accessToken = ep.accessToken;

      if (isExpired && ep.refreshToken) {
        const refreshed = await refreshGmailToken(ep.refreshToken);
        if (refreshed) {
          await prisma.emailProvider.update({
            where: { userId },
            data: { accessToken: refreshed.accessToken, tokenExpiry: refreshed.tokenExpiry },
          });
          accessToken = refreshed.accessToken;
        }
      }

      const result = await sendViaGmail(accessToken, ep.fromEmail, ep.fromName, {
        to: ep.fromEmail,
        donorName: 'Test Donor',
        orgName: ep.fromName,
        totalAmount: 100,
        dateRange: 'Test',
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Provider not supported for test yet' }, { status: 400 });
  }

  // Test with unsaved Resend form values
  if (action === 'test_unsaved') {
    const { fromEmail, fromName, resendApiKey } = body;
    if (!resendApiKey || !fromEmail || !fromName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const result = await sendViaResend(resendApiKey, fromEmail, fromName, {
      to: fromEmail,
      donorName: 'Test Donor',
      orgName: fromName,
      totalAmount: 100,
      dateRange: 'Test',
    });
    return NextResponse.json(result);
  }

  // Save SES config (fromEmail = reply-to address)
  if (body.provider === 'ses') {
    const { fromEmail, fromName } = body;
    if (!fromEmail || !fromName) {
      return NextResponse.json({ error: 'fromEmail and fromName are required' }, { status: 400 });
    }
    await prisma.emailProvider.upsert({
      where: { userId },
      create: { userId, provider: 'ses', fromEmail, fromName },
      update: { provider: 'ses', fromEmail, fromName, resendApiKey: null, accessToken: null, refreshToken: null, tokenExpiry: null },
    });
    return NextResponse.json({ success: true });
  }

  // Save Resend config
  const { fromEmail, fromName, resendApiKey } = body;
  if (!fromEmail || !fromName || !resendApiKey) {
    return NextResponse.json({ error: 'fromEmail, fromName, and resendApiKey are required' }, { status: 400 });
  }
  await prisma.emailProvider.upsert({
    where: { userId },
    create: { userId, provider: 'resend', fromEmail, fromName, resendApiKey },
    update: { provider: 'resend', fromEmail, fromName, resendApiKey },
  });
  return NextResponse.json({ success: true });
}
