import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendViaResend, sendViaGmail, sendViaSES, refreshGmailToken } from '@/lib/emailService';
import type { SendLetterParams } from '@/lib/emailService';

const DonorSchema = z.object({
  donorName: z.string().min(1),
  donorEmail: z.string().email(),
  totalAmount: z.number().positive(),
  dateRange: z.string().optional(),
  orgName: z.string().optional(),
  taxId: z.string().optional(),
  donations: z.array(z.object({
    date: z.string(),
    description: z.string(),
    amount: z.number(),
  })).optional(),
  pdfUrl: z.string().optional(),
});

export const SendLetterSchema = z.object({
  action: z.enum(['bulk', 'single']).optional(),
  donors: z.array(DonorSchema).optional(),
  donorName: z.string().optional(),
  donorEmail: z.string().optional(),
  totalAmount: z.number().optional(),
  dateRange: z.string().optional(),
  orgName: z.string().optional(),
  taxId: z.string().optional(),
  donations: z.array(z.object({
    date: z.string(),
    description: z.string(),
    amount: z.number(),
  })).optional(),
});

type EmailProvider = {
  provider: string;
  fromEmail: string;
  fromName: string;
  resendApiKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  userId: string;
};

/** Resolves a valid access token, refreshing if needed. Returns updated ep. */
async function resolveGmailToken(ep: EmailProvider): Promise<{ accessToken: string; ep: EmailProvider } | null> {
  const fiveMinutes = 5 * 60 * 1000;
  const isExpired = !ep.tokenExpiry || ep.tokenExpiry.getTime() - Date.now() < fiveMinutes;

  if (!isExpired && ep.accessToken) {
    return { accessToken: ep.accessToken, ep };
  }

  if (!ep.refreshToken) return null;

  const refreshed = await refreshGmailToken(ep.refreshToken);
  if (!refreshed) return null;

  // Persist new token
  const updated = await prisma.emailProvider.update({
    where: { userId: ep.userId },
    data: { accessToken: refreshed.accessToken, tokenExpiry: refreshed.tokenExpiry },
  });

  return { accessToken: refreshed.accessToken, ep: updated as EmailProvider };
}

async function sendWithProvider(ep: EmailProvider, params: SendLetterParams) {
  if (ep.provider === 'ses') {
    return sendViaSES(ep.fromName, ep.fromEmail, params);
  }

  if (ep.provider === 'resend' && ep.resendApiKey) {
    return sendViaResend(ep.resendApiKey, ep.fromEmail, ep.fromName, params);
  }

  if (ep.provider === 'gmail') {
    const resolved = await resolveGmailToken(ep);
    if (!resolved) return { success: false, error: 'Gmail token expired — please reconnect in Settings.' };
    return sendViaGmail(resolved.accessToken, ep.fromEmail, ep.fromName, params);
  }

  return { success: false, error: `Provider "${ep.provider}" not yet supported` };
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = SendLetterSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const ep = await prisma.emailProvider.findUnique({ where: { userId } }) as EmailProvider | null;
  if (!ep) {
    return NextResponse.json(
      { error: 'Email not configured. Set up your email provider in Settings.', configUrl: '/settings' },
      { status: 400 }
    );
  }

  // Bulk send
  if (body.action === 'bulk') {
    const donors: { donorName: string; donorEmail: string; totalAmount: number; dateRange?: string; orgName: string; taxId?: string; donations?: { date: string; description: string; amount: number }[] }[] = body.donors ?? [];
    const sent: string[] = [];
    const failed: { name: string; email: string; error: string }[] = [];

    for (const donor of donors) {
      if (!donor.donorEmail) {
        failed.push({ name: donor.donorName, email: '', error: 'No email address' });
        continue;
      }
      const result = await sendWithProvider(ep, {
        to: donor.donorEmail,
        donorName: donor.donorName,
        orgName: donor.orgName,
        totalAmount: donor.totalAmount,
        dateRange: donor.dateRange,
        taxId: donor.taxId,
        donations: donor.donations,
      });

      await prisma.emailLog.create({
        data: {
          userId,
          recipient: donor.donorEmail,
          recipientName: donor.donorName,
          subject: `Your donation receipt from ${donor.orgName}`,
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error ?? null,
        },
      });

      if (result.success) {
        sent.push(donor.donorName);
      } else {
        failed.push({ name: donor.donorName, email: donor.donorEmail, error: result.error ?? 'Unknown error' });
      }

      // Rate limit — 300ms between sends
      if (donors.indexOf(donor) < donors.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return NextResponse.json({ success: true, sent: sent.length, failed });
  }

  // Single send
  const { donorName, donorEmail, totalAmount, dateRange, orgName, taxId, donations } = body;
  if (!donorEmail) return NextResponse.json({ error: 'donorEmail is required' }, { status: 400 });

  const result = await sendWithProvider(ep, { to: donorEmail, donorName, orgName, totalAmount, dateRange, taxId, donations });

  await prisma.emailLog.create({
    data: {
      userId,
      recipient: donorEmail,
      recipientName: donorName,
      subject: `Your donation receipt from ${orgName}`,
      status: result.success ? 'sent' : 'failed',
      errorMessage: result.error ?? null,
    },
  });

  return NextResponse.json(result);
}
