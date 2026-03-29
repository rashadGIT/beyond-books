import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';

export const UpdateAccountSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    if (!connection?.isActive) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }
    const parsed = UpdateAccountSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }
    const qbs = getQuickBooksService();
    const updated = await qbs.updateAccountForConnection(connection, id, parsed.data);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
