import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000';

  if (error || !code || !state) {
    return NextResponse.redirect(`${baseUrl}/settings?email_error=gmail_denied`);
  }

  // Decode userId from state
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = decoded.userId;
    if (!userId) throw new Error('missing userId');
  } catch {
    return NextResponse.redirect(`${baseUrl}/settings?email_error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${baseUrl}/api/auth/email/gmail/callback`;

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok || !tokens.access_token) {
    return NextResponse.redirect(`${baseUrl}/settings?email_error=token_exchange_failed`);
  }

  // Get the user's real Gmail address
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileRes.json();
  const fromEmail: string = profile.email ?? '';
  const fromName: string = profile.name ?? fromEmail;

  // Calculate token expiry
  const tokenExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  // Store in DB
  await prisma.emailProvider.upsert({
    where: { userId },
    create: {
      userId,
      provider: 'gmail',
      fromEmail,
      fromName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry,
    },
    update: {
      provider: 'gmail',
      fromEmail,
      fromName,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      tokenExpiry,
    },
  });

  return NextResponse.redirect(`${baseUrl}/settings?email_connected=gmail`);
}
