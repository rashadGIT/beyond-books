import { NextResponse } from 'next/server';
import { getQuickBooksService } from '@/lib/quickbooksService';
import { randomBytes } from 'crypto';

export async function GET() {
  try {
    const qbService = getQuickBooksService();

    // Generate random state for CSRF protection
    const state = randomBytes(16).toString('hex');

    // Store state in session/cookie if needed for validation
    // For now, we'll just generate the URL

    const authUrl = qbService.getAuthorizationUrl(state);

    // Redirect to QuickBooks authorization page
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('QuickBooks connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate QuickBooks connection', message: error.message },
      { status: 500 }
    );
  }
}
