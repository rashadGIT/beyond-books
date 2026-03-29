import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const BrandingSchema = z.object({
  orgName: z.string().optional(),
  tagLine: z.string().optional(),
  taxId: z.string().optional(),
  signerName: z.string().optional(),
  signerTitle: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
});

const DEFAULT_BRANDING = {
  orgName: 'Your Organization',
  tagLine: 'Building stronger communities together',
  taxId: 'XX-XXXXXXX',
  signerName: 'Your Name',
  signerTitle: 'Executive Director',
  logoUrl: null,
  primaryColor: '#2563eb',
};

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const branding = await prisma.orgBranding.findUnique({ where: { userId } });
  return NextResponse.json(branding ?? { ...DEFAULT_BRANDING, userId });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BrandingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const branding = await prisma.orgBranding.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return NextResponse.json(branding);
}
