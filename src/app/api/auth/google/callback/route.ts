import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const CallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

// Cognito exchanges the code for tokens at this endpoint.
// After Google login, Cognito redirects here with an authorization code.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_URL!;

  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(error)}`, appUrl)
    );
  }

  const parsed = CallbackQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.redirect(new URL('/sign-in?error=missing_code', appUrl));
  }

  const { code } = parsed.data;

  try {
    const domain = process.env.COGNITO_DOMAIN!;
    const clientId = process.env.COGNITO_CLIENT_ID!;
    const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/auth/google/callback`;

    // Exchange code for tokens with Cognito
    const tokenRes = await fetch(`${domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return NextResponse.redirect(new URL('/sign-in?error=token_exchange_failed', appUrl));
    }

    const tokens = await tokenRes.json();

    // Decode the id_token to get user info (it's a JWT — no need to verify here, Cognito already did)
    const idPayload = JSON.parse(
      Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString()
    );

    const userId = idPayload.sub as string;
    const email = idPayload.email as string;
    const name = (idPayload.name || idPayload['cognito:username'] || email.split('@')[0]) as string;

    // Ensure user exists in DB
    await prisma.user.upsert({
      where: { id: userId },
      update: { email, name },
      create: { id: userId, email, name },
    });

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    const response = NextResponse.redirect(new URL('/', appUrl));

    response.cookies.set('access_token', tokens.access_token, {
      ...cookieOpts,
      maxAge: tokens.expires_in || 3600,
    });
    response.cookies.set('id_token', tokens.id_token, {
      ...cookieOpts,
      maxAge: tokens.expires_in || 3600,
    });
    if (tokens.refresh_token) {
      response.cookies.set('refresh_token', tokens.refresh_token, {
        ...cookieOpts,
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (err: any) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(new URL('/sign-in?error=auth_failed', appUrl));
  }
}
