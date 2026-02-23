/**
 * Scheduler Service - Manages in-memory cron tasks using node-cron
 * Singleton pattern ensures only one scheduler instance exists
 */

import cron from 'node-cron';
import { prisma } from './prisma';

interface SchedulerTask {
  jobId: string;
  cronExpression: string;
  task: ReturnType<typeof cron.schedule>;
}

class JobScheduler {
  private tasks: Map<string, SchedulerTask> = new Map();
  private isInitialized = false;

  /**
   * Initialize all active jobs for a user
   */
  async initializeUserJobs(userId: string) {
    const jobs = await prisma.scheduledJob.findMany({
      where: {
        userId,
        isActive: true,
        cronExpression: { not: null },
      },
    });

    let scheduledCount = 0;
    for (const job of jobs) {
      if (job.cronExpression) {
        try {
          // Only schedule if not already scheduled
          if (!this.tasks.has(job.id)) {
            this.scheduleJob(job.id, job.cronExpression, userId);
            scheduledCount++;
          }
        } catch (error) {
          console.error(`[Scheduler] Failed to schedule job ${job.id}:`, error);
        }
      }
    }

    this.isInitialized = true;
    if (scheduledCount > 0) {
      console.log(`[Scheduler] Initialized ${scheduledCount} new jobs for user ${userId}`);
    }
  }

  /**
   * Schedule a single job
   */
  scheduleJob(jobId: string, cronExpression: string, userId: string) {
    // Remove existing if present
    this.unscheduleJob(jobId);

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Create the cron task
    const task = cron.schedule(
      cronExpression,
      async () => {
        try {
          console.log(`[Scheduler] Running job ${jobId} at ${new Date().toISOString()}`);

          // Dynamically import JobService to avoid circular dependency
          const { JobService } = await import('./jobService');
          await JobService.runJob(jobId);
        } catch (error) {
          console.error(`[Scheduler] Job ${jobId} execution failed:`, error);
        }
      },
      {
        timezone: process.env.SCHEDULER_TIMEZONE || 'America/Chicago',
      }
    );

    this.tasks.set(jobId, { jobId, cronExpression, task });
    console.log(`[Scheduler] Scheduled job ${jobId} with cron: ${cronExpression}`);
  }

  /**
   * Remove a scheduled job
   */
  unscheduleJob(jobId: string) {
    const existing = this.tasks.get(jobId);
    if (existing) {
      existing.task.stop();
      this.tasks.delete(jobId);
      console.log(`[Scheduler] Unscheduled job ${jobId}`);
    }
  }

  /**
   * Get all active schedules
   */
  getActiveSchedules() {
    return Array.from(this.tasks.values()).map((t) => ({
      jobId: t.jobId,
      cronExpression: t.cronExpression,
    }));
  }

  /**
   * Check if scheduler is initialized
   */
  isSchedulerInitialized() {
    return this.isInitialized;
  }

  /**
   * Cleanup - stop all tasks
   */
  shutdown() {
    for (const task of this.tasks.values()) {
      task.task.stop();
    }
    this.tasks.clear();
    this.isInitialized = false;
    console.log('[Scheduler] Shutdown complete');
  }
}

// Singleton instance
export const scheduler = new JobScheduler();
