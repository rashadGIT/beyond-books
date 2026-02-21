import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processCSV, processExcel } from '@/lib/parser';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { StandardizedTransaction } from '@/lib/types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Validate file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExt = path.extname(file.name).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only CSV and Excel files are supported.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to S3
    const s3Key = `uploads/${Date.now()}-${file.name}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
    }));

    // Process the file
    let parsedData;
    if (fileExt === '.csv') {
      const content = buffer.toString('utf-8');
      parsedData = processCSV(content);
    } else {
      parsedData = await processExcel(file);
    }

    // Calculate totals
    const totalAmount = parsedData.transactions.reduce(
      (sum: number, tx: StandardizedTransaction) => sum + tx.grossAmount,
      0
    );

    const userId = request.headers.get('x-user-id') || 'anonymous';

    // Save to database
    const processedFile = await prisma.processedFile.create({
      data: {
        userId,
        filename: file.name,
        source: parsedData.source,
        fileSize: file.size,
        transactionCount: parsedData.transactions.length,
        totalAmount,
        filePath: s3Key, // Store S3 key instead of local path
        transactions: {
          create: parsedData.transactions.map((tx: StandardizedTransaction) => ({
            transactionId: tx.id,
            date: tx.date,
            source: tx.source,
            donorName: tx.donorName,
            donorEmail: tx.donorEmail,
            grossAmount: tx.grossAmount,
            fee: tx.fee,
            netAmount: tx.netAmount,
            description: tx.description,
            originalData: JSON.stringify(tx.originalData),
          })),
        },
      },
      include: {
        transactions: true,
      },
    });

    return NextResponse.json({
      success: true,
      file: processedFile,
      summary: {
        filename: file.name,
        source: parsedData.source,
        transactionCount: parsedData.transactions.length,
        totalAmount,
      },
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file', message: error.message },
      { status: 500 }
    );
  }
}
