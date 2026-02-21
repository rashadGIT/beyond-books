import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksService } from '@/lib/quickbooksService';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/settings?qb_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !realmId || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/settings?qb_error=missing_parameters`
      );
    }

    // Decode userId from state
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = stateData.userId;
      if (!userId) throw new Error('No userId in state');
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/settings?qb_error=invalid_state`
      );
    }

    const qbService = getQuickBooksService();

    const tokens = await qbService.getAccessToken(code);

    // Ensure user record exists (first-time QB connect before DB user created)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@unknown.local` },
    });

    // Save connection scoped to this user
    await qbService.saveConnectionForUser(userId, {
      realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      refreshExpiresIn: tokens.x_refresh_token_expires_in,
    });

    // Fetch company name
    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (connection) {
      try {
        const companyInfo = await qbService.getCompanyInfoForConnection(connection);
        const companyName = companyInfo?.CompanyInfo?.CompanyName;
        if (companyName) {
          await prisma.quickBooksConnection.update({
            where: { userId },
            data: { companyName },
          });
        }
      } catch {
        // Non-critical — connection saved, company name is just cosmetic
      }
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/settings?qb_connected=true`
    );
  } catch (error: any) {
    console.error('QuickBooks callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/settings?qb_error=${encodeURIComponent(error.message)}`
    );
  }
}
