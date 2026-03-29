// Mock the direct '../prisma' import used in schedulerService.ts
jest.mock('../prisma', () => require('../../../__mocks__/prisma'));

import cron from 'node-cron';
import { prisma } from '../../../__mocks__/prisma';

// We need a fresh scheduler singleton for each test group that tests state,
// so we use jest.isolateModules where necessary.

const mockSchedule = jest.mocked(cron.schedule);
const mockValidate = jest.mocked(cron.validate);
const mockStop = jest.fn();

beforeEach(() => {
  mockSchedule.mockReturnValue({ stop: mockStop } as any);
  mockValidate.mockReturnValue(true);
  mockStop.mockClear();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('scheduler.scheduleJob', () => {
  it('calls cron.schedule with the provided cron expression', async () => {
    const { scheduler } = await import('../schedulerService');
    scheduler.scheduleJob('job-1', '0 9 * * *', 'user-1');

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 9 * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: expect.any(String) })
    );
  });

  it('throws for an invalid cron expression', async () => {
    mockValidate.mockReturnValueOnce(false);

    const { scheduler } = await import('../schedulerService');
    expect(() => scheduler.scheduleJob('job-bad', 'not-valid-cron', 'user-1')).toThrow(
      'Invalid cron expression'
    );
  });

  it('replaces an existing job when called with the same jobId', async () => {
    const { scheduler } = await import('../schedulerService');
    scheduler.scheduleJob('job-replace', '0 8 * * *', 'user-1');
    scheduler.scheduleJob('job-replace', '0 10 * * *', 'user-1');

    // stop() should have been called for the first schedule
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});

describe('scheduler.unscheduleJob', () => {
  it('stops the cron task when the job exists', async () => {
    const { scheduler } = await import('../schedulerService');
    scheduler.scheduleJob('job-to-remove', '0 9 * * *', 'user-1');
    scheduler.unscheduleJob('job-to-remove');

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the job does not exist', async () => {
    const { scheduler } = await import('../schedulerService');
    // Should not throw
    expect(() => scheduler.unscheduleJob('nonexistent-job')).not.toThrow();
    expect(mockStop).not.toHaveBeenCalled();
  });
});

describe('scheduler.getActiveSchedules', () => {
  it('returns the list of scheduled jobs', async () => {
    jest.isolateModules(() => {
      const { scheduler } = require('../schedulerService');
      scheduler.scheduleJob('job-a', '0 9 * * *', 'user-1');
      scheduler.scheduleJob('job-b', '30 14 * * 1', 'user-1');

      const schedules = scheduler.getActiveSchedules();
      const ids = schedules.map((s: any) => s.jobId);
      expect(ids).toContain('job-a');
      expect(ids).toContain('job-b');
    });
  });

  it('removes job from active schedules after unschedule', async () => {
    jest.isolateModules(() => {
      const { scheduler } = require('../schedulerService');
      scheduler.scheduleJob('job-temp', '0 9 * * *', 'user-1');
      scheduler.unscheduleJob('job-temp');

      const schedules = scheduler.getActiveSchedules();
      expect(schedules.find((s: any) => s.jobId === 'job-temp')).toBeUndefined();
    });
  });
});

describe('scheduler.scheduleQbSyncJob', () => {
  it('calls cron.schedule with the provided sync cron expression', async () => {
    const { scheduler } = await import('../schedulerService');
    scheduler.scheduleQbSyncJob('user-sync-1', '0 */6 * * *');

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 */6 * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: expect.any(String) })
    );
  });

  it('throws for an invalid QB sync cron expression', async () => {
    mockValidate.mockReturnValueOnce(false);

    const { scheduler } = await import('../schedulerService');
    expect(() => scheduler.scheduleQbSyncJob('user-1', 'bad-cron')).toThrow(
      'Invalid cron expression for QB sync'
    );
  });

  it('replaces existing QB sync task for the same userId', async () => {
    const { scheduler } = await import('../schedulerService');
    scheduler.scheduleQbSyncJob('user-dup', '0 6 * * *');
    scheduler.scheduleQbSyncJob('user-dup', '0 8 * * *');

    // stop should have been called for the first task
    expect(mockStop).toHaveBeenCalledTimes(1);
  });
});

describe('scheduler.unscheduleQbSyncJob', () => {
  it('stops the QB sync task when it exists', async () => {
    const { scheduler } = await import('../schedulerService');
    scheduler.scheduleQbSyncJob('user-remove', '0 6 * * *');
    scheduler.unscheduleQbSyncJob('user-remove');

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no QB sync task exists for user', async () => {
    const { scheduler } = await import('../schedulerService');
    expect(() => scheduler.unscheduleQbSyncJob('no-such-user')).not.toThrow();
    expect(mockStop).not.toHaveBeenCalled();
  });
});

describe('scheduler.shutdown', () => {
  it('stops all scheduled tasks and marks scheduler as not initialized', async () => {
    jest.isolateModules(() => {
      const { scheduler } = require('../schedulerService');
      scheduler.scheduleJob('job-x', '0 9 * * *', 'user-1');
      scheduler.scheduleJob('job-y', '0 10 * * *', 'user-2');
      scheduler.scheduleQbSyncJob('user-1', '0 6 * * *');

      scheduler.shutdown();

      // 3 tasks should have been stopped
      expect(mockStop).toHaveBeenCalledTimes(3);
      expect(scheduler.isSchedulerInitialized()).toBe(false);
      expect(scheduler.getActiveSchedules()).toHaveLength(0);
    });
  });
});

describe('scheduler.initializeUserJobs', () => {
  it('schedules active jobs with cronExpression for the user', async () => {
    const mockJobs = [
      { id: 'job-1', userId: 'user-init', cronExpression: '0 9 * * *', isActive: true },
      { id: 'job-2', userId: 'user-init', cronExpression: '30 14 * * 1', isActive: true },
    ];
    prisma.scheduledJob.findMany.mockResolvedValue(mockJobs as any);
    prisma.quickBooksConnection.findUnique.mockResolvedValue(null);

    // Use isolateModules to get a fresh scheduler state
    await jest.isolateModulesAsync(async () => {
      const { scheduler } = require('../schedulerService');
      await scheduler.initializeUserJobs('user-init');

      expect(cron.schedule).toHaveBeenCalledTimes(2);
      expect(scheduler.isSchedulerInitialized()).toBe(true);
    });
  });

  it('also schedules QB auto-sync when connection has autoSyncEnabled', async () => {
    prisma.scheduledJob.findMany.mockResolvedValue([]);
    prisma.quickBooksConnection.findUnique.mockResolvedValue({
      userId: 'user-qb',
      autoSyncEnabled: true,
      autoSyncCron: '0 */4 * * *',
    } as any);

    await jest.isolateModulesAsync(async () => {
      const { scheduler } = require('../schedulerService');
      await scheduler.initializeUserJobs('user-qb');

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 */4 * * *',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });
});
