import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';
import { ExcelService } from '@/lib/excelService';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });

const VALID_TYPES = ['invoices', 'customers', 'vendors', 'products', 'chart_of_accounts'];

async function downloadFromS3(s3Key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({
    Bucket: process.env.BB_S3_BUCKET,
    Key: s3Key,
  }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { entityType, fileId } = await request.json();

    if (!VALID_TYPES.includes(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    // Find the uploaded QB import file
    const processedFile = fileId
      ? await prisma.processedFile.findFirst({ where: { id: fileId, userId } })
      : await prisma.processedFile.findFirst({
          where: { userId, source: 'QB_IMPORT' },
          orderBy: { createdAt: 'desc' },
        });

    if (!processedFile) {
      return NextResponse.json(
        { error: 'No import file found. Please upload a spreadsheet first.' },
        { status: 400 }
      );
    }

    // Download from S3 and parse
    const buffer = await downloadFromS3(processedFile.filePath);
    const rows = ExcelService.parseFile(buffer, processedFile.filename);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (!connection) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }

    const qb = getQuickBooksService();

    let created = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, string>;
      const rowNum = i + 2; // 1-indexed + header row

      try {
        if (entityType === 'customers') {
          const displayName = row['DisplayName']?.trim();
          if (!displayName) { errors.push({ row: rowNum, reason: 'DisplayName is required' }); continue; }
          await qb.createCustomerForConnection(connection, {
            displayName,
            email: row['Email']?.trim() || undefined,
            phone: row['Phone']?.trim() || undefined,
            companyName: row['CompanyName']?.trim() || undefined,
            billingAddress: row['BillingAddress']?.trim() || undefined,
          });

        } else if (entityType === 'vendors') {
          const displayName = row['DisplayName']?.trim();
          if (!displayName) { errors.push({ row: rowNum, reason: 'DisplayName is required' }); continue; }
          await qb.createVendorForConnection(connection, {
            displayName,
            email: row['Email']?.trim() || undefined,
            phone: row['Phone']?.trim() || undefined,
            companyName: row['CompanyName']?.trim() || undefined,
          });

        } else if (entityType === 'invoices') {
          const customerName = row['CustomerName']?.trim();
          const itemName = row['ItemName']?.trim();
          const unitPrice = parseFloat(row['UnitPrice'] ?? '');
          if (!customerName) { errors.push({ row: rowNum, reason: 'CustomerName is required' }); continue; }
          if (!itemName) { errors.push({ row: rowNum, reason: 'ItemName is required' }); continue; }
          if (isNaN(unitPrice) || unitPrice <= 0) { errors.push({ row: rowNum, reason: 'UnitPrice must be a positive number' }); continue; }
          const qty = parseFloat(row['Quantity'] ?? '1') || 1;
          await qb.createInvoiceForConnection(connection, {
            customerName,
            items: [{ name: itemName, qty, unitPrice }],
            dueDate: row['DueDate']?.trim() || undefined,
            memo: row['Memo']?.trim() || undefined,
          });

        } else if (entityType === 'products') {
          const name = row['Name']?.trim();
          if (!name) { errors.push({ row: rowNum, reason: 'Name is required' }); continue; }
          const unitPrice = row['UnitPrice'] ? parseFloat(row['UnitPrice']) : undefined;
          await qb.createItemForConnection(connection, {
            name,
            description: row['Description']?.trim() || undefined,
            unitPrice: unitPrice && !isNaN(unitPrice) ? unitPrice : undefined,
            type: row['Type']?.trim() || 'Service',
          });

        } else if (entityType === 'chart_of_accounts') {
          const name = row['Name']?.trim();
          const accountType = row['AccountType']?.trim();
          if (!name) { errors.push({ row: rowNum, reason: 'Name is required' }); continue; }
          if (!accountType) { errors.push({ row: rowNum, reason: 'AccountType is required' }); continue; }
          await qb.createAccountForConnection(connection, {
            name,
            accountType,
            description: row['Description']?.trim() || undefined,
            accountNumber: row['AccountNumber']?.trim() || undefined,
          });
        }

        created++;
      } catch (rowErr: unknown) {
        errors.push({ row: rowNum, reason: (rowErr as Error).message });
      }
    }

    return NextResponse.json({
      created,
      skipped: errors.length,
      total: rows.length,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
