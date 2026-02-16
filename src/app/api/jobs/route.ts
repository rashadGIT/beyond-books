import { NextResponse } from 'next/server';
import { JobService } from '@/lib/jobService';

export async function GET() {
  try {
    console.log('API: Seeding if empty...');
    await JobService.seedIfEmpty();
    
    console.log('API: Fetching jobs and history...');
    const [jobs, history] = await Promise.all([
      JobService.getScheduledJobs(),
      JobService.getExecutions()
    ]);
    
    return NextResponse.json({ jobs, history });
  } catch (error: any) {
    console.error('CRITICAL_API_ERROR:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Check if we are creating a new job or running an existing one
    if (body.type && body.label && body.schedule) {
      const job = await JobService.createJob(body);
      return NextResponse.json(job);
    } else {
      const { jobId } = body;
      const execution = await JobService.runJob(jobId);
      return NextResponse.json(execution);
    }
  } catch (error: any) {
    console.error('CRITICAL_POST_ERROR:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}