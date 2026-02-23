import { NextRequest, NextResponse } from 'next/server';
import { PDFService } from '@/lib/pdfService';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }

  try {
    const url = await PDFService.getPresignedUrl(key);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
