// Mock the direct '../prisma' import used in jobService.ts
jest.mock('../prisma', () => require('../../../__mocks__/prisma'));

import { JobService } from '../jobService';
import { prisma } from '../../../__mocks__/prisma';

// Mock schedulerService to prevent actual cron scheduling
jest.mock('../schedulerService', () => ({
  scheduler: {
    scheduleJob: jest.fn(),
    unscheduleJob: jest.fn(),
  },
}));

// Mock qbMcpExecutor to prevent real QB connections
jest.mock('../qbMcpExecutor', () => ({
  createQbMcpClient: jest.fn().mockResolvedValue(null),
}));

// Mock aiProviders to avoid real AI calls
jest.mock('../aiProviders', () => ({
  generateAIResponse: jest.fn().mockResolvedValue({
    content: 'AI generated report content',
    toolCalls: [],
  }),
}));

const userId = 'user-test-123';

describe('JobService.getScheduledJobs', () => {
  it('returns jobs for the given userId', async () => {
    const mockJobs = [
      { id: 'job-1', userId, label: 'Daily Report', cronExpression: '0 9 * * *', isActive: true },
    ];
    prisma.scheduledJob.findMany.mockResolvedValue(mockJobs as any);

    const jobs = await JobService.getScheduledJobs(userId);
    expect(jobs).toEqual(mockJobs);
    expect(prisma.scheduledJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } })
    );
  });
});

describe('JobService.getExecutions', () => {
  it('returns recent executions for the user ordered by startedAt desc', async () => {
    const mockExecutions = [
      { id: 'exec-1', jobId: 'job-1', status: 'completed', startedAt: new Date() },
    ];
    prisma.jobExecution.findMany.mockResolvedValue(mockExecutions as any);

    const executions = await JobService.getExecutions(userId);
    expect(executions).toEqual(mockExecutions);
    expect(prisma.jobExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { job: { userId } },
        take: 20,
      })
    );
  });
});

describe('JobService.createJob', () => {
  it('creates a job with a generated cron expression', async () => {
    prisma.scheduledJob.findFirst.mockResolvedValue(null); // no existing job with same label
    prisma.scheduledJob.create.mockResolvedValue({
      id: 'job-new',
      userId,
      label: 'Morning Digest',
      schedule: '09:00 AM',
      frequency: 'DAILY',
      cronExpression: '0 9 * * *',
      isActive: true,
    } as any);

    const job = await JobService.createJob(userId, {
      prompt: 'Summarize today\'s financials',
      label: 'Morning Digest',
      schedule: '09:00 AM',
      frequency: 'DAILY',
    });

    expect(job.label).toBe('Morning Digest');
    expect(prisma.scheduledJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          cronExpression: '0 9 * * *',
          isActive: true,
        }),
      })
    );
  });

  it('uses a custom cronExpression when provided', async () => {
    prisma.scheduledJob.findFirst.mockResolvedValue(null);
    prisma.scheduledJob.create.mockResolvedValue({
      id: 'job-custom',
      cronExpression: '15 10 * * 1',
    } as any);

    await JobService.createJob(userId, {
      prompt: 'Weekly summary',
      label: 'Weekly Summary',
      schedule: '10:15 AM',
      frequency: 'WEEKLY',
      cronExpression: '15 10 * * 1',
    });

    expect(prisma.scheduledJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cronExpression: '15 10 * * 1' }),
      })
    );
  });

  it('throws when a job with the same label already exists for the user', async () => {
    prisma.scheduledJob.findFirst.mockResolvedValue({
      id: 'existing',
      label: 'Morning Digest',
    } as any);

    await expect(
      JobService.createJob(userId, {
        prompt: 'duplicate',
        label: 'Morning Digest',
        schedule: '09:00 AM',
      })
    ).rejects.toThrow('Morning Digest');
  });
});

describe('JobService.updateJob', () => {
  it('throws when job is not found', async () => {
    prisma.scheduledJob.findUnique.mockResolvedValue(null);

    await expect(
      JobService.updateJob('nonexistent-id', { label: 'Updated' })
    ).rejects.toThrow('Job not found');
  });

  it('updates job and regenerates cron when schedule changes', async () => {
    prisma.scheduledJob.findUnique.mockResolvedValue({
      id: 'job-1',
      userId,
      schedule: '09:00 AM',
      frequency: 'DAILY',
      cronExpression: '0 9 * * *',
      isActive: true,
    } as any);

    prisma.scheduledJob.update.mockResolvedValue({
      id: 'job-1',
      userId,
      schedule: '02:00 PM',
      frequency: 'DAILY',
      cronExpression: '0 14 * * *',
      isActive: true,
    } as any);

    const updated = await JobService.updateJob('job-1', { schedule: '02:00 PM' });
    expect(updated.cronExpression).toBe('0 14 * * *');
  });
});

describe('JobService.deleteJob', () => {
  it('deletes executions then the job', async () => {
    prisma.jobExecution.deleteMany.mockResolvedValue({ count: 3 } as any);
    prisma.scheduledJob.delete.mockResolvedValue({ id: 'job-1' } as any);

    await JobService.deleteJob('job-1');

    expect(prisma.jobExecution.deleteMany).toHaveBeenCalledWith({ where: { jobId: 'job-1' } });
    expect(prisma.scheduledJob.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } });
  });
});

describe('JobService.runJob', () => {
  beforeEach(() => {
    prisma.jobExecution.create.mockResolvedValue({ id: 'exec-new', status: 'running' } as any);
    prisma.scheduledJob.findUnique.mockResolvedValue({
      id: 'job-1',
      userId,
      prompt: 'Show recent invoices',
      user: { id: userId },
    } as any);
    prisma.quickBooksConnection.findUnique.mockResolvedValue(null);
    prisma.aISettings.findFirst.mockResolvedValue(null);
    prisma.jobExecution.update.mockResolvedValue({
      id: 'exec-new',
      status: 'completed',
      result: 'AI generated report content',
    } as any);
    prisma.scheduledJob.update.mockResolvedValue({ id: 'job-1' } as any);
  });

  it('creates an execution record and updates it to completed on success', async () => {
    const execution = await JobService.runJob('job-1');

    expect(prisma.jobExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobId: 'job-1', status: 'running' }),
      })
    );

    expect(prisma.jobExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      })
    );
  });

  it('updates lastRunAt on the scheduled job after execution', async () => {
    await JobService.runJob('job-1');

    expect(prisma.scheduledJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ lastRunAt: expect.any(Date) }),
      })
    );
  });

  it('marks execution as failed and updates when job is not found', async () => {
    prisma.scheduledJob.findUnique.mockResolvedValue(null);
    prisma.jobExecution.update.mockResolvedValue({ id: 'exec-new', status: 'failed' } as any);

    const execution = await JobService.runJob('nonexistent-job', 3); // retryCount=3 to skip retry
    expect(prisma.jobExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
  });
});
