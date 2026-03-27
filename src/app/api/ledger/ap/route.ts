import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (!connection?.isActive) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }
    const qbs = getQuickBooksService();
    const data = await qbs.getApSubledgerForConnection(connection);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
