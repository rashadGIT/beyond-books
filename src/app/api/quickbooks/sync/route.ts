import { NextRequest, NextResponse } from 'next/server';
import { runQbSyncForUser } from '@/lib/qbSyncService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await runQbSyncForUser(userId);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('QuickBooks sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync QuickBooks data', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });

    if (!connection) {
      return NextResponse.json({ connected: false, message: 'No active QuickBooks connection' });
    }

    return NextResponse.json({
      connected: true,
      companyName: connection.companyName,
      lastSyncAt: connection.lastSyncAt,
      realmId: connection.realmId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
