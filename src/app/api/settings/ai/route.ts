import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 7) + '...' + key.slice(-4);
}

async function ensureUser(userId: string, request: NextRequest) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: request.headers.get('x-user-email') || `${userId}@unknown.local`,
      name: request.headers.get('x-user-name') || undefined,
    },
  });
}

// GET — return all saved AI keys for this user
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const settings = await prisma.aISettings.findMany({ where: { userId } });
    return NextResponse.json(
      settings.map(s => ({
        provider: s.provider,
        model: s.model,
        maskedKey: maskKey(s.apiKey),
        isActive: s.isActive,
      }))
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — upsert a key for a specific provider, optionally set it active
export async function PUT(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { provider, apiKey, model, setActive = true } = await request.json();
    if (!provider || !apiKey || !model) {
      return NextResponse.json({ error: 'provider, apiKey, and model are required' }, { status: 400 });
    }

    await ensureUser(userId, request);

    // If setting active, deactivate all others first
    if (setActive) {
      await prisma.aISettings.updateMany({
        where: { userId, provider: { not: provider } },
        data: { isActive: false },
      });
    }

    const settings = await prisma.aISettings.upsert({
      where: { userId_provider: { userId, provider } },
      update: { apiKey, model, ...(setActive ? { isActive: true } : {}) },
      create: { userId, provider, apiKey, model, isActive: setActive },
    });

    return NextResponse.json({
      provider: settings.provider,
      model: settings.model,
      maskedKey: maskKey(settings.apiKey),
      isActive: settings.isActive,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — set a provider as active (deactivates others)
export async function PATCH(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { provider } = await request.json();
    if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

    await prisma.aISettings.updateMany({ where: { userId }, data: { isActive: false } });
    await prisma.aISettings.update({
      where: { userId_provider: { userId, provider } },
      data: { isActive: true },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove one provider's key; if it was active, activate the next available one
export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { provider } = await request.json();
    if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

    const deleted = await prisma.aISettings.delete({
      where: { userId_provider: { userId, provider } },
    });

    // If we just deleted the active key, activate the next available one
    if (deleted.isActive) {
      const next = await prisma.aISettings.findFirst({ where: { userId } });
      if (next) {
        await prisma.aISettings.update({ where: { id: next.id }, data: { isActive: true } });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
