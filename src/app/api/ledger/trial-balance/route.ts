import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';

export const DateRangeSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

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
    const qp = DateRangeSchema.safeParse(Object.fromEntries(searchParams));
    if (!qp.success) {
      return NextResponse.json({ error: 'Validation failed', details: qp.error.flatten() }, { status: 400 });
    }
    const start = qp.data.start ?? defaults.start;
    const end = qp.data.end ?? defaults.end;

    const qbs = getQuickBooksService();
    const data = await qbs.getTrialBalanceForConnection(connection, start, end);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
