import { prisma } from './prisma';
import { MockQuickBooksService } from './mockQuickbooks';
import { FileService } from './fileService';

const MAX_RETRIES = 3;

export const JobService = {
  getScheduledJobs: async (userId: string) => {
    return await prisma.scheduledJob.findMany({
      where: { userId },
      orderBy: { schedule: 'asc' },
    });
  },

  getExecutions: async (userId: string) => {
    return await prisma.jobExecution.findMany({
      where: { job: { userId } },
      include: { job: true },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  },

  createJob: async (userId: string, data: { type: string; label: string; schedule: string; frequency?: string }) => {
    return await prisma.scheduledJob.create({
      data: {
        userId,
        ...data,
        frequency: data.frequency || 'DAILY',
      },
    });
  },

  runJob: async (jobId: string, retryCount = 0): Promise<any> => {
    const execution = await prisma.jobExecution.create({
      data: {
        jobId,
        status: 'running',
        retryCount
      }
    });

    try {
      const job = await prisma.scheduledJob.findUnique({ where: { id: jobId } });
      if (!job) throw new Error('ERR_JOB_NOT_FOUND');

      let resultMessage = '';
      let details = '';

      if (job.type === 'DATA_FETCH') {
        const fileResults = await FileService.processDemoFiles();
        const totalAmount = fileResults.reduce((s, r) => s + r.total, 0);
        
        resultMessage = `Ingested ${fileResults.length} files ($${totalAmount.toFixed(2)}).`;
        
        // Create a detail list of transactions
        details = fileResults.flatMap(r => r.transactions).map(t => 
          `• ${t.donorName}: $${t.grossAmount.toFixed(2)} (${t.date})`
        ).join('\n');
      } else {
        await MockQuickBooksService.resolveIdentity(job.label, 'system@revive.org');
        resultMessage = 'Identity Resolution: 100% Match.';
      }

      const sync = await MockQuickBooksService.createSalesReceipt('auto', 0);

      return await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          result: `${resultMessage}\n${details}\nRef: ${sync.data.refNo}`,
          latency: sync.latency,
          completedAt: new Date()
        }
      });

    } catch (error: any) {
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(res => setTimeout(res, delay));
        return await JobService.runJob(jobId, retryCount + 1);
      }

      return await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          result: `FATAL: ${error.message}`,
          completedAt: new Date()
        }
      });
    } finally {
      await prisma.scheduledJob.update({
        where: { id: jobId },
        data: { lastRunAt: new Date() }
      });
    }
  },

  seedIfEmpty: async (userId: string) => {
    const count = await prisma.scheduledJob.count({ where: { userId } });
    if (count === 0) {
      await prisma.scheduledJob.createMany({
        data: [
          { userId, type: 'DATA_FETCH', label: 'Stripe API Reconciliation', schedule: '12:00 PM', frequency: 'HOURLY' },
          { userId, type: 'IDENTITY_SYNC', label: 'PayPal Donor Verification', schedule: '01:30 PM', frequency: 'DAILY' },
          { userId, type: 'REPORT_GEN', label: 'Weekly Revenue Summary', schedule: '05:00 PM', frequency: 'WEEKLY' },
        ],
      });
    }
  }
};
