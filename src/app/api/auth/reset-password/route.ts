import { NextRequest, NextResponse } from 'next/server';
import { confirmForgotPassword } from '@/lib/cognito';

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Email, code, and new password are required.' }, { status: 400 });
    }

    await confirmForgotPassword(email, code, newPassword);
    return NextResponse.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === 'CodeMismatchException') {
      return NextResponse.json({ error: 'Invalid reset code. Please check and try again.' }, { status: 400 });
    }
    if (name === 'ExpiredCodeException') {
      return NextResponse.json({ error: 'Reset code has expired. Please request a new one.' }, { status: 400 });
    }
    if (name === 'InvalidPasswordException') {
      return NextResponse.json({ error: 'Password must be at least 8 characters with uppercase, lowercase, and a number.' }, { status: 400 });
    }
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Password reset failed. Please try again.' }, { status: 500 });
  }
}
