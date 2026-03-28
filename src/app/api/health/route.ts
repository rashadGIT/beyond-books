import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      env: {
        BB_SES_KEY_ID: process.env.BB_SES_KEY_ID ? `${process.env.BB_SES_KEY_ID.slice(0, 8)}...` : 'NOT SET',
        BB_SES_SECRET: process.env.BB_SES_SECRET ? 'SET' : 'NOT SET',
        SES_FROM_EMAIL: process.env.SES_FROM_EMAIL ?? 'NOT SET',
        AWS_REGION: process.env.AWS_REGION ?? 'NOT SET',
      },
    });
  } catch (e: any) {
    console.error('[health] DB error:', e?.message ?? e);
    return NextResponse.json({ status: 'error', db: 'disconnected', message: e?.message }, { status: 503 });
  }
}
