import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { forgotPassword } from '@/lib/cognito';

export const EmailSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  const parsed = EmailSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { email } = parsed.data;

  try {
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
