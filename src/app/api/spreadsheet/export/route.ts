import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';
import { ExcelService } from '@/lib/excelService';

export const ExportSchema = z.object({
  dataType: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = ExportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const { dataType, startDate, endDate, format } = parsed.data;

  try {
    if (!['invoices', 'payments', 'sales_receipts'].includes(dataType)) {
      return NextResponse.json({ error: 'Invalid dataType' }, { status: 400 });
    }

    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (!connection) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }

    const qb = getQuickBooksService();

    // Fetch QB data
    let qbData: any;
    let rows: Record<string, unknown>[] = [];

    if (dataType === 'invoices') {
      qbData = await qb.getInvoicesForConnection(connection, startDate, endDate);
      const invoices: any[] = qbData?.QueryResponse?.Invoice ?? [];
      rows = invoices.map(ExcelService.mapInvoiceToRow);
    } else if (dataType === 'payments') {
      qbData = await qb.getPaymentsForConnection(connection, startDate, endDate);
      const payments: any[] = qbData?.QueryResponse?.Payment ?? [];
      rows = payments.map(ExcelService.mapPaymentToRow);
    } else {
      qbData = await qb.getSalesReceiptsForConnection(connection, startDate, endDate);
      const receipts: any[] = qbData?.QueryResponse?.SalesReceipt ?? [];
      rows = receipts.map(ExcelService.mapSalesReceiptToRow);
    }

    if (rows.length === 0) {
      rows = [{}]; // empty sheet still has headers via template
    }

    // Generate file
    const timestamp = Date.now();
    let fileBuffer: Buffer;
    let contentType: string;
    let ext: string;

    if (format === 'csv') {
      fileBuffer = Buffer.from(ExcelService.generateCSV(rows), 'utf-8');
      contentType = 'text/csv';
      ext = 'csv';
    } else {
      fileBuffer = ExcelService.generateExcel(rows, dataType);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    }

    // Save to public/exports/ for direct download (no S3 required in dev)
    const { default: fs } = await import('fs');
    const { default: path } = await import('path');
    const exportsDir = path.join(process.cwd(), 'public', 'exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    const filename = `${dataType}-${timestamp}.${ext}`;
    fs.writeFileSync(path.join(exportsDir, filename), fileBuffer);
    const downloadUrl = `/exports/${filename}`;

    return NextResponse.json({ downloadUrl, recordCount: rows.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
