import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmSignUp } from '@/lib/cognito';

export const ConfirmSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = ConfirmSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, code } = parsed.data;

  try {
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
