import { NextRequest, NextResponse } from 'next/server';
import { JobService } from '@/lib/jobService';
import { scheduler } from '@/lib/schedulerService';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Initialize scheduler for this user on first request (handles cold starts)
    await scheduler.initializeUserJobs(userId);

    const [jobs, history] = await Promise.all([
      JobService.getScheduledJobs(userId),
      JobService.getExecutions(userId),
    ]);

    return NextResponse.json({ jobs, history });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    // Create new job (has prompt, label, schedule)
    if (body.prompt && body.label && body.schedule) {
      const job = await JobService.createJob(userId, body);
      return NextResponse.json(job);
    }
    // OR manually run existing job
    else {
      const { jobId } = body;
      const execution = await JobService.runJob(jobId);
      return NextResponse.json(execution);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { jobId } = await request.json();
    await JobService.deleteJob(jobId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
