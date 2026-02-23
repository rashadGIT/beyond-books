import { NextRequest, NextResponse } from 'next/server';
import { resendConfirmationCode } from '@/lib/cognito';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    await resendConfirmationCode(email);
    return NextResponse.json({ success: true, message: 'Verification code resent. Check your email.' });
  } catch (err: unknown) {
    console.error('[resend-code]', err);
    return NextResponse.json({ error: 'Failed to resend code. Please try again.' }, { status: 500 });
  }
}
