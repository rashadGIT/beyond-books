import { NextRequest, NextResponse } from 'next/server';
import { JobService } from '@/lib/jobService';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await JobService.seedIfEmpty(userId);

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

    if (body.type && body.label && body.schedule) {
      const job = await JobService.createJob(userId, body);
      return NextResponse.json(job);
    } else {
      const { jobId } = body;
      const execution = await JobService.runJob(jobId);
      return NextResponse.json(execution);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
