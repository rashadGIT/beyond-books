import { NextRequest, NextResponse } from 'next/server';
import { getQuickBooksService } from '@/lib/quickbooksService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body;

    const qbService = getQuickBooksService();

    // Verify connection exists for this user
    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (!connection) {
      return NextResponse.json(
        { error: 'No active QuickBooks connection' },
        { status: 401 }
      );
    }

    // Fetch sales receipts, invoices, and payments
    const [salesReceipts, invoices, payments] = await Promise.all([
      qbService.getSalesReceiptsForConnection(connection, startDate, endDate),
      qbService.getInvoicesForConnection(connection, startDate, endDate),
      qbService.getPaymentsForConnection(connection, startDate, endDate),
    ]);

    // Transform and save to database
    const transactions = [];

    // Process sales receipts
    if (salesReceipts.QueryResponse?.SalesReceipt) {
      for (const receipt of salesReceipts.QueryResponse.SalesReceipt) {
        transactions.push({
          transactionId: receipt.Id,
          date: receipt.TxnDate,
          source: 'quickbooks',
          donorName: receipt.CustomerRef?.name || 'Unknown',
          donorEmail: receipt.BillEmail?.Address || '',
          grossAmount: parseFloat(receipt.TotalAmt || 0),
          fee: 0,
          netAmount: parseFloat(receipt.TotalAmt || 0),
          description: 'Sales Receipt',
          originalData: JSON.stringify(receipt),
        });
      }
    }

    // Process invoices
    if (invoices.QueryResponse?.Invoice) {
      for (const invoice of invoices.QueryResponse.Invoice) {
        transactions.push({
          transactionId: invoice.Id,
          date: invoice.TxnDate,
          source: 'quickbooks',
          donorName: invoice.CustomerRef?.name || 'Unknown',
          donorEmail: invoice.BillEmail?.Address || '',
          grossAmount: parseFloat(invoice.TotalAmt || 0),
          fee: 0,
          netAmount: parseFloat(invoice.TotalAmt || 0),
          description: 'Invoice',
          originalData: JSON.stringify(invoice),
        });
      }
    }

    // Process payments
    if (payments.QueryResponse?.Payment) {
      for (const payment of payments.QueryResponse.Payment) {
        transactions.push({
          transactionId: payment.Id,
          date: payment.TxnDate,
          source: 'quickbooks',
          donorName: payment.CustomerRef?.name || 'Unknown',
          donorEmail: '',
          grossAmount: parseFloat(payment.TotalAmt || 0),
          fee: 0,
          netAmount: parseFloat(payment.TotalAmt || 0),
          description: 'Payment',
          originalData: JSON.stringify(payment),
        });
      }
    }

    // Create a processed file record
    const processedFile = await prisma.processedFile.create({
      data: {
        userId,
        filename: `QuickBooks Sync ${new Date().toISOString()}`,
        source: 'quickbooks',
        fileSize: 0,
        transactionCount: transactions.length,
        totalAmount: transactions.reduce((sum, t) => sum + t.grossAmount, 0),
        transactions: {
          create: transactions,
        },
      },
    });

    // Update last sync time
    await prisma.quickBooksConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      transactionCount: transactions.length,
      fileId: processedFile.id,
      totalAmount: transactions.reduce((sum, t) => sum + t.grossAmount, 0),
    });
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
      return NextResponse.json({
        connected: false,
        message: 'No active QuickBooks connection',
      });
    }

    return NextResponse.json({
      connected: true,
      companyName: connection.companyName,
      lastSyncAt: connection.lastSyncAt,
      realmId: connection.realmId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
