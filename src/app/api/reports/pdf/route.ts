import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';

const PDF_DIR = path.join(process.cwd(), 'generated-pdfs');

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get('file');

  // Validate: only allow simple filenames with no path traversal
  if (!file || !/^[\w\-]+\.pdf$/.test(file)) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }

  try {
    const filePath = path.join(PDF_DIR, file);
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
