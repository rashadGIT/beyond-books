import { NextRequest, NextResponse } from 'next/server';
import { confirmSignUp } from '@/lib/cognito';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and confirmation code are required' }, { status: 400 });
    }

    await confirmSignUp(email, code);

    return NextResponse.json({ success: true, message: 'Email verified! You can now sign in.' });
  } catch (error: any) {
    const msg = error?.name === 'CodeMismatchException'
      ? 'Invalid verification code'
      : error?.name === 'ExpiredCodeException'
      ? 'Code has expired. Please request a new one.'
      : 'Verification failed. Please try again.';

    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
