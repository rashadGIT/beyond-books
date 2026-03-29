import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signUp } from '@/lib/cognito';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = RegisterSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, name } = parsed.data;

  try {
    await signUp(email, password, name);

    return NextResponse.json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
    });
  } catch (error: any) {
    const msg = error?.name === 'UsernameExistsException'
      ? 'An account with this email already exists'
      : error?.name === 'InvalidPasswordException'
      ? 'Password must be at least 8 characters with uppercase, lowercase, and a number'
      : 'Registration failed. Please try again.';

    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
