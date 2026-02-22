import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const name = request.headers.get('x-user-name');
  const email = request.headers.get('x-user-email');
  const id = request.headers.get('x-user-id');
  if (!id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ id, email, name });
}
