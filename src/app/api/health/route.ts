import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch (e: any) {
    console.error('[health] DB error:', e?.message ?? e);
    return NextResponse.json({ status: 'error', db: 'disconnected', message: e?.message }, { status: 503 });
  }
}
