import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start') ?? undefined;
  const end = searchParams.get('end') ?? undefined;

  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
  if (!connection?.isActive) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
  }

  try {
    const qb = getQuickBooksService();
    const data = await qb.getSalesReceiptsForConnection(connection, start, end);
    const receipts: any[] = data?.QueryResponse?.SalesReceipt ?? [];

    // Find receipts missing a billing email and collect their customer IDs
    const missingEmailIds = [...new Set(
      receipts
        .filter(r => !r.BillEmail?.Address && r.CustomerRef?.value)
        .map(r => r.CustomerRef.value as string)
    )];

    // Look up customer emails from QB and backfill into receipts
    if (missingEmailIds.length > 0) {
      const idList = missingEmailIds.map(id => `'${id}'`).join(', ');
      const customerData = await qb.queryForConnection<any>(
        connection,
        `SELECT Id, PrimaryEmailAddr FROM Customer WHERE Id IN (${idList})`
      );
      const customers: any[] = customerData?.QueryResponse?.Customer ?? [];
      const emailMap: Record<string, string> = {};
      for (const c of customers) {
        if (c.PrimaryEmailAddr?.Address) {
          emailMap[c.Id] = c.PrimaryEmailAddr.Address;
        }
      }
      for (const r of receipts) {
        if (!r.BillEmail?.Address && r.CustomerRef?.value && emailMap[r.CustomerRef.value]) {
          r.BillEmail = { Address: emailMap[r.CustomerRef.value] };
        }
      }
    }

    return NextResponse.json({ receipts });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
