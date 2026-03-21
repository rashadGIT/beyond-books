import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: 'us-east-1' });
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      return NextResponse.json({ error: 'Only CSV and Excel files are supported' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3 under qb-imports/ prefix
    const s3Key = `qb-imports/${userId}/${Date.now()}-${file.name}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.BB_S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
    }));

    // Ensure user record exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@unknown.local` },
    });

    // Store as ProcessedFile with source='QB_IMPORT' so the import route can find it
    const processedFile = await prisma.processedFile.create({
      data: {
        userId,
        filename: file.name,
        source: 'QB_IMPORT',
        fileSize: file.size,
        transactionCount: 0,
        totalAmount: 0,
        filePath: s3Key,
      },
    });

    return NextResponse.json({ fileId: processedFile.id, filename: file.name, s3Key });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
