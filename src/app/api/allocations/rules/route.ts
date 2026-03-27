import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rules = await prisma.allocationRule.findMany({
      where: { userId },
      include: { splits: { include: { program: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(rules);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, splits } = await request.json() as {
      name: string;
      splits: { programId: string; percentage: number }[];
    };

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (!splits?.length) return NextResponse.json({ error: 'splits required' }, { status: 400 });

    const total = splits.reduce((s, sp) => s + sp.percentage, 0);
    if (Math.abs(total - 100) > 0.01) {
      return NextResponse.json({ error: `Splits must sum to 100% (got ${total}%)` }, { status: 400 });
    }

    const rule = await prisma.allocationRule.create({
      data: {
        userId,
        name,
        splits: { create: splits.map(sp => ({ programId: sp.programId, percentage: sp.percentage })) },
      },
      include: { splits: { include: { program: true } } },
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    await prisma.allocationRule.deleteMany({ where: { id, userId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
