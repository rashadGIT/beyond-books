import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const logs = await prisma.emailLog.findMany({
    where: { userId },
    orderBy: { sentAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ logs });
}
