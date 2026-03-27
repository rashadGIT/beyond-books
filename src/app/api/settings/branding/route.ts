import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

  const body = await request.json();

  // Only accept known fields — strip anything else
  const allowed = ['orgName', 'tagLine', 'taxId', 'signerName', 'signerTitle', 'logoUrl', 'primaryColor'] as const;
  const data: Partial<Record<typeof allowed[number], string>> = {};
  for (const key of allowed) {
    if (key in body && typeof body[key] === 'string') {
      data[key] = body[key];
    }
  }

  const branding = await prisma.orgBranding.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return NextResponse.json(branding);
}
