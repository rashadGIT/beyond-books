import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (!connection?.isActive) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const defaults = currentMonthRange();
    const start = searchParams.get('start') ?? defaults.start;
    const end = searchParams.get('end') ?? defaults.end;

    const qbs = getQuickBooksService();
    const data = await qbs.getGeneralLedgerForConnection(connection, start, end);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
