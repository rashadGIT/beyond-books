import { NextRequest, NextResponse } from 'next/server';
import { signUp } from '@/lib/cognito';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

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
