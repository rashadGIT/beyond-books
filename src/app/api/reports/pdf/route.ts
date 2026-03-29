import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PDFService } from '@/lib/pdfService';

export const ReportSchema = z.object({
  key: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const parsed = ReportSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
  }
  const { key } = parsed.data;

  try {
    const url = await PDFService.getPresignedUrl(key);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
