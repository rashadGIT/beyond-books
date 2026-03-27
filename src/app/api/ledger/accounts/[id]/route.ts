import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (!connection?.isActive) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }
    const body = await request.json() as { name?: string; description?: string; active?: boolean };
    const qbs = getQuickBooksService();
    const updated = await qbs.updateAccountForConnection(connection, id, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
