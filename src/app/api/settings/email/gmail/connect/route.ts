import { NextRequest, NextResponse } from 'next/server';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.redirect(new URL('/sign-in', request.url));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Gmail OAuth not configured' }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/email/gmail/callback`;

  // Encode userId in state for retrieval after redirect
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
