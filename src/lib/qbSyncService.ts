/**
 * QB Sync Service — reusable sync logic shared by the API route and the auto-sync scheduler.
 */

import { prisma } from './prisma';
import { getQuickBooksService } from './quickbooksService';

export interface QbSyncResult {
  transactionCount: number;
  totalAmount: number;
  fileId: string;
}

export async function runQbSyncForUser(userId: string): Promise<QbSyncResult> {
  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
  if (!connection || !connection.isActive) {
    throw new Error('No active QuickBooks connection');
  }

  const qbService = getQuickBooksService();

  const [salesReceipts, invoices, payments] = await Promise.all([
    qbService.getSalesReceiptsForConnection(connection),
    qbService.getInvoicesForConnection(connection),
    qbService.getPaymentsForConnection(connection),
  ]);

  const transactions: Array<{
    transactionId: string;
    date: string;
    source: string;
    donorName: string;
    donorEmail: string;
    grossAmount: number;
    fee: number;
    netAmount: number;
    description: string;
    originalData: string;
  }> = [];

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

  const totalAmount = transactions.reduce((sum, t) => sum + t.grossAmount, 0);

  const processedFile = await prisma.processedFile.create({
    data: {
      userId,
      filename: `QuickBooks Auto-Sync ${new Date().toISOString()}`,
      source: 'quickbooks',
      fileSize: 0,
      transactionCount: transactions.length,
      totalAmount,
      transactions: { create: transactions },
    },
  });

  await prisma.quickBooksConnection.update({
    where: { id: connection.id },
    data: { lastSyncAt: new Date() },
  });

  console.log(`[QbSync] Synced ${transactions.length} transactions for user ${userId}`);

  return { transactionCount: transactions.length, totalAmount, fileId: processedFile.id };
}
