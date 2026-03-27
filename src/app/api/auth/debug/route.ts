import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth-edge';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return NextResponse.json({ error: 'no cookie' });

  let verifyResult: any = null;
  let verifyError: string | null = null;
  try {
    verifyResult = await verifyTokenEdge(token);
  } catch (e: any) {
    verifyError = e.message;
  }

  return NextResponse.json({ verifyResult, verifyError });
}
