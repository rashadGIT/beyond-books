import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmForgotPassword } from '@/lib/cognito';

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const parsed = ResetPasswordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, code, newPassword } = parsed.data;

  try {
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
