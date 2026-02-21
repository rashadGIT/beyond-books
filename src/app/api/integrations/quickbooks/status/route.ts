import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const connection = await prisma.quickBooksConnection.findUnique({
      where: { userId },
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json({ connected: false, companyName: null, lastSyncAt: null });
    }

    return NextResponse.json({
      connected: true,
      companyName: connection.companyName,
      lastSyncAt: connection.lastSyncAt?.toISOString() || null,
      realmId: connection.realmId,
    });
  } catch (error: any) {
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  }
}
