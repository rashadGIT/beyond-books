import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const AllocationRuleSchema = z.object({
  name: z.string().min(1),
  splits: z.array(z.object({
    programId: z.string().min(1),
    percentage: z.number(),
  })).min(1),
});

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
    const parsed = AllocationRuleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, splits } = parsed.data;

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
