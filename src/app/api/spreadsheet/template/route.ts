import { NextRequest, NextResponse } from 'next/server';
import { ExcelService } from '@/lib/excelService';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PDFService } from '@/lib/pdfService';

const s3 = new S3Client({ region: 'us-east-1' });

const VALID_TYPES = ['invoices', 'customers', 'vendors', 'products', 'chart_of_accounts'];

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') ?? '';
  const format = searchParams.get('format') ?? 'xlsx';

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  try {
    const rows = ExcelService.getTemplateRows(type);

    let fileBuffer: Buffer;
    let contentType: string;
    let ext: string;

    if (format === 'csv') {
      fileBuffer = Buffer.from(ExcelService.generateCSV(rows), 'utf-8');
      contentType = 'text/csv';
      ext = 'csv';
    } else {
      fileBuffer = ExcelService.generateExcel(rows, type);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    }

    // Use stable S3 keys (no timestamp) so templates are cached/reused
    const s3Key = `templates/${type}-import-template.${ext}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.BB_S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
    }));

    const downloadUrl = await PDFService.getPresignedUrl(s3Key);
    return NextResponse.redirect(downloadUrl);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
