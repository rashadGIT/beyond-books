import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resendConfirmationCode } from '@/lib/cognito';

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
    await resendConfirmationCode(email);
    return NextResponse.json({ success: true, message: 'Verification code resent. Check your email.' });
  } catch (err: unknown) {
    console.error('[resend-code]', err);
    return NextResponse.json({ error: 'Failed to resend code. Please try again.' }, { status: 500 });
  }
}
