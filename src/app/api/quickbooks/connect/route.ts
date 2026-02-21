import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksService } from '@/lib/quickbooksService';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    const qbService = getQuickBooksService();

    // Encode userId into the OAuth state so the callback can recover it
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');

    const authUrl = qbService.getAuthorizationUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('QuickBooks connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate QuickBooks connection', message: error.message },
      { status: 500 }
    );
  }
}
