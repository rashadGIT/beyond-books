import { NextRequest, NextResponse } from 'next/server';
import { forgotPassword } from '@/lib/cognito';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    await forgotPassword(email);
    return NextResponse.json({ success: true, message: 'Reset code sent. Check your email.' });
  } catch (err: unknown) {
    const code = (err as { name?: string }).name;
    if (code === 'UserNotFoundException') {
      // Don't reveal whether the email exists
      return NextResponse.json({ success: true, message: 'Reset code sent. Check your email.' });
    }
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Failed to send reset code. Please try again.' }, { status: 500 });
  }
}
