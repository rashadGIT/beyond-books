/**
 * Scheduler Initialization Route
 * Triggered by AWS EventBridge every 5 minutes to ensure jobs run after cold starts
 */

import { NextRequest, NextResponse } from 'next/server';
import { scheduler } from '@/lib/schedulerService';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  // Verify it's an internal/scheduled request from AWS EventBridge
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all unique user IDs
    const users = await prisma.user.findMany({ select: { id: true } });

    let totalScheduled = 0;
    for (const user of users) {
      await scheduler.initializeUserJobs(user.id);
    }

    const activeSchedules = scheduler.getActiveSchedules();
    totalScheduled = activeSchedules.length;

    console.log(`[Scheduler Init] Initialized ${totalScheduled} jobs for ${users.length} users`);

    return NextResponse.json({
      success: true,
      scheduledJobs: totalScheduled,
      users: users.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Scheduler Init] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
