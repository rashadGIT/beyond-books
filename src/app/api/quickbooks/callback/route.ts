import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksService } from '@/lib/quickbooksService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle error from QuickBooks
    if (error) {
      console.error('QuickBooks OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/?qb_error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    if (!code || !realmId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/?qb_error=missing_parameters`
      );
    }

    const qbService = getQuickBooksService();

    // Exchange code for tokens
    const tokens = await qbService.getAccessToken(code);

    // Save connection to database first
    await qbService.saveConnection({
      realmId: realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      refreshExpiresIn: tokens.x_refresh_token_expires_in,
    });

    // Now test the connection by getting company info
    const companyInfo = await qbService.getCompanyInfo();

    // Update with company name
    await qbService.saveConnection({
      realmId: realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      refreshExpiresIn: tokens.x_refresh_token_expires_in,
      companyName: companyInfo.CompanyInfo?.CompanyName || 'Unknown',
    });

    console.log('✅ QuickBooks connected successfully:', {
      realmId,
      companyName: companyInfo.CompanyInfo?.CompanyName,
    });

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/?qb_connected=true`
    );
  } catch (error: any) {
    console.error('QuickBooks callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/?qb_error=${encodeURIComponent(error.message)}`
    );
  }
}
