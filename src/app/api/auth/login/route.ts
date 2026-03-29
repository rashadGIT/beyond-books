import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signIn } from '@/lib/cognito';
import { prisma } from '@/lib/prisma';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = LoginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password } = parsed.data;

  try {
    const result = await signIn(email, password);
    const tokens = result.AuthenticationResult;

    if (!tokens?.AccessToken || !tokens?.IdToken || !tokens?.RefreshToken) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    // Decode IdToken to get user info (it's a JWT)
    const idTokenPayload = JSON.parse(
      Buffer.from(tokens.IdToken.split('.')[1], 'base64url').toString()
    );
    const userId = idTokenPayload.sub as string;
    const userName = idTokenPayload.name as string | undefined;

    // Ensure user exists in our DB
    await prisma.user.upsert({
      where: { id: userId },
      update: { email, name: userName || email.split('@')[0] },
      create: { id: userId, email, name: userName || email.split('@')[0] },
    });

    const response = NextResponse.json({ success: true, userId });

    // Store tokens in httpOnly cookies (7 day expiry for refresh)
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookies.set('access_token', tokens.AccessToken, {
      ...cookieOpts,
      maxAge: tokens.ExpiresIn || 3600,
    });
    response.cookies.set('id_token', tokens.IdToken, {
      ...cookieOpts,
      maxAge: tokens.ExpiresIn || 3600,
    });
    response.cookies.set('refresh_token', tokens.RefreshToken, {
      ...cookieOpts,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error: any) {
    const msg = error?.name === 'NotAuthorizedException'
      ? 'Incorrect email or password'
      : error?.name === 'UserNotConfirmedException'
      ? 'Please verify your email before signing in'
      : 'Sign in failed. Please try again.';

    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
