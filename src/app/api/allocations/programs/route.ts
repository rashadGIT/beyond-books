import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const ProgramSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const programs = await prisma.program.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(programs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const parsed = ProgramSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const { name, type } = parsed.data;
    const validTypes = ['PROGRAM', 'LOCATION', 'GRANT'];
    if (!validTypes.includes(type)) return NextResponse.json({ error: `type must be one of ${validTypes.join(', ')}` }, { status: 400 });

    // Sync QB Class if connected
    let qbClassId: string | undefined;
    try {
      const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
      if (connection?.isActive) {
        const { getQuickBooksService } = await import('@/lib/quickbooksService');
        const qbSvc = getQuickBooksService();
        const cls = await qbSvc.createClassForConnection(connection, name);
        qbClassId = cls.id;
      }
    } catch {
      // QB not connected or failed — continue without QB Class
    }

    const program = await prisma.program.create({
      data: { userId, name, type, qbClassId },
    });
    return NextResponse.json(program, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await request.json();
    await prisma.program.updateMany({ where: { id, userId }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
