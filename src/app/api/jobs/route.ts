import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { JobService } from '@/lib/jobService';
import { scheduler } from '@/lib/schedulerService';

export const CreateJobSchema = z.object({
  prompt: z.string().min(1),
  label: z.string().min(1),
  schedule: z.string().min(1),
  frequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY']).optional(),
});

export const RunJobSchema = z.object({
  jobId: z.string().min(1),
});

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
    const rawBody = await request.json();

    // Create new job (has prompt, label, schedule)
    if (rawBody.prompt && rawBody.label && rawBody.schedule) {
      const parsed = CreateJobSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }
      const job = await JobService.createJob(userId, parsed.data);
      return NextResponse.json(job);
    }
    // OR manually run existing job
    else {
      const parsed = RunJobSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
      }
      const execution = await JobService.runJob(parsed.data.jobId);
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
