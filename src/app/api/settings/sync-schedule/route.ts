import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scheduler } from '@/lib/schedulerService';
import { parseScheduleToCron } from '@/lib/cronUtils';

/**
 * GET  — return current auto-sync settings for the connected QB account
 * POST — enable/disable auto-sync + persist cron expression
 */

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
  if (!connection) {
    return NextResponse.json({ autoSyncEnabled: false, autoSyncCron: null, schedule: null, frequency: null });
  }

  return NextResponse.json({
    autoSyncEnabled: connection.autoSyncEnabled,
    autoSyncCron: connection.autoSyncCron,
  });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { enabled, schedule, frequency } = body as {
    enabled: boolean;
    schedule?: string;  // e.g. "09:00 AM"
    frequency?: string; // "HOURLY" | "DAILY" | "WEEKLY"
  };

  const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
  if (!connection) {
    return NextResponse.json({ error: 'No QuickBooks connection found' }, { status: 404 });
  }

  let cronExpression: string | null = connection.autoSyncCron;

  if (enabled) {
    if (!schedule || !frequency) {
      return NextResponse.json({ error: 'schedule and frequency are required when enabling auto-sync' }, { status: 400 });
    }
    try {
      cronExpression = parseScheduleToCron(schedule, frequency);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Wire the scheduler
    scheduler.scheduleQbSyncJob(userId, cronExpression);
  } else {
    // Disable — unschedule the running task
    scheduler.unscheduleQbSyncJob(userId);
  }

  // Persist the preference
  await prisma.quickBooksConnection.update({
    where: { id: connection.id },
    data: {
      autoSyncEnabled: enabled,
      autoSyncCron: enabled ? cronExpression : null,
    },
  });

  return NextResponse.json({ success: true, autoSyncEnabled: enabled, autoSyncCron: cronExpression });
}
