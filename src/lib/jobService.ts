import { prisma } from './prisma';
import { parseScheduleToCron } from './cronUtils';
import { generateAIResponse, AIMessage, AIOverride } from './aiProviders';
import type { AITool } from './aiProviders';
import { createQbMcpClient } from './qbMcpExecutor';

const MAX_RETRIES = 3;
const MAX_TOOL_ITERATIONS = 5;
const MAX_RESULT_CHARS = 12_000;

function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isoDate = new Date().toISOString().slice(0, 10);
  return `You are a helpful financial assistant for nonprofit and small business accounting.
You have access to the user's QuickBooks data through tools.
When asked about finances, donors, transactions, customers, invoices, or payments, use the available tools to look up real data before answering.
Present numbers clearly, use plain English, and offer actionable insights where helpful.
If QuickBooks is not connected, let the user know they can connect it in Settings.
If a tool call fails or returns an error, include the exact error message in your response so the user can diagnose the problem.

QuickBooks IDS query language limitations for run_custom_query: only supports WHERE operators =, !=, LIKE, IN, BETWEEN, CONTAINS. It does NOT support > or < comparisons. To find unpaid invoices (Balance > 0), use the get_unpaid_invoices tool instead of a custom query.

Today's date is ${today} (${isoDate}). Use this when interpreting relative dates like "this month", "last month", "this year", "recent", etc.`;
}

/**
 * Execute an AI prompt with full tool-calling capabilities
 * This is the core function that makes scheduled jobs AI-powered
 */
async function executeAIPrompt(userId: string, prompt: string): Promise<{ content: string }> {
  // Load user's QB connection and AI settings
  const qbConnection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
  const mcpClient = qbConnection ? await createQbMcpClient(qbConnection) : null;
  const tools: AITool[] = mcpClient
    ? (await mcpClient.listTools()).tools.map((t) => ({
        name: t.name,
        description: t.description ?? '',
        inputSchema: t.inputSchema as AITool['inputSchema'],
      }))
    : [];

  const userAISettings = await prisma.aISettings.findFirst({
    where: { userId, isActive: true },
  });
  const aiOverride: AIOverride | undefined = userAISettings
    ? {
        provider: userAISettings.provider as AIOverride['provider'],
        apiKey: userAISettings.apiKey,
        model: userAISettings.model,
      }
    : undefined;

  // Agentic loop: call AI → execute tools → call AI again → repeat
  let finalContent = '';
  let iterationCount = 0;
  const loopMessages: AIMessage[] = [{ role: 'user', content: prompt }];

  while (iterationCount < MAX_TOOL_ITERATIONS) {
    iterationCount++;

    let aiResponse;
    try {
      aiResponse = await generateAIResponse(buildSystemPrompt(), loopMessages, tools, aiOverride);
    } catch (aiError: any) {
      finalContent = `I'm having trouble connecting to the AI service. Please check the AI configuration. (${aiError.message})`;
      break;
    }

    if (!aiResponse.toolCalls || aiResponse.toolCalls.length === 0) {
      finalContent = aiResponse.content;
      break;
    }

    // Execute each tool call via in-process MCP
    const toolResults: Array<{ id: string; name: string; content: string }> = [];

    for (const toolCall of aiResponse.toolCalls) {
      let resultContent: string;

      if (!mcpClient) {
        resultContent = `Tool "${toolCall.name}" failed: QuickBooks is not connected.`;
        toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
        continue;
      }

      try {
        const resultObj = await mcpClient.callTool({
          name: toolCall.name,
          arguments: toolCall.input as Record<string, unknown>,
        });
        const rawText =
          (resultObj.content as Array<{ type: string; text: string }>)?.[0]?.text ?? JSON.stringify(resultObj);
        const truncated =
          rawText.length > MAX_RESULT_CHARS
            ? rawText.slice(0, MAX_RESULT_CHARS) + '\n... [truncated — too many results]'
            : rawText;
        resultContent = `Tool "${toolCall.name}" result:\n${truncated}`;
      } catch (toolErr) {
        const msg = toolErr instanceof Error ? toolErr.message : String(toolErr);
        console.error(`[jobService/executeAIPrompt] Tool "${toolCall.name}" error:`, msg);
        resultContent = `Tool "${toolCall.name}" failed: ${msg}`;
      }

      toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
    }

    // Append AI's tool-use turn and tool results
    loopMessages.push({
      role: 'assistant',
      content: aiResponse.content || '',
      _toolCallsRaw: aiResponse.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      })),
    });

    for (const result of toolResults) {
      loopMessages.push({
        role: 'tool',
        content: result.content,
        _toolCallId: result.id,
      });
    }
  }

  if (mcpClient) await mcpClient.close();

  if (!finalContent) {
    finalContent = 'I was unable to complete your request. Please try again.';
  }

  return { content: finalContent };
}

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

  createJob: async (
    userId: string,
    data: { prompt: string; label: string; schedule: string; frequency?: string; cronExpression?: string }
  ) => {
    const frequency = data.frequency || 'DAILY';

    // Generate cron expression if not provided
    const cronExpression = data.cronExpression || parseScheduleToCron(data.schedule, frequency);

    const job = await prisma.scheduledJob.create({
      data: {
        userId,
        prompt: data.prompt,
        label: data.label,
        schedule: data.schedule,
        frequency,
        cronExpression,
        isActive: true,
      },
    });

    // Schedule immediately in-memory (for current process)
    const { scheduler } = await import('./schedulerService');
    scheduler.scheduleJob(job.id, cronExpression, userId);

    return job;
  },

  updateJob: async (
    jobId: string,
    data: {
      prompt?: string;
      label?: string;
      schedule?: string;
      frequency?: string;
      isActive?: boolean;
    }
  ) => {
    const job = await prisma.scheduledJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');

    let cronExpression = job.cronExpression;

    // Regenerate cron if schedule or frequency changed
    if (data.schedule || data.frequency) {
      cronExpression = parseScheduleToCron(
        data.schedule || job.schedule,
        data.frequency || job.frequency
      );
    }

    const updated = await prisma.scheduledJob.update({
      where: { id: jobId },
      data: {
        ...data,
        cronExpression,
      },
    });

    // Update scheduler
    const { scheduler } = await import('./schedulerService');
    if (updated.isActive && updated.cronExpression) {
      scheduler.scheduleJob(updated.id, updated.cronExpression, updated.userId);
    } else {
      scheduler.unscheduleJob(updated.id);
    }

    return updated;
  },

  deleteJob: async (jobId: string) => {
    // Unschedule first
    const { scheduler } = await import('./schedulerService');
    scheduler.unscheduleJob(jobId);

    // Delete from DB
    await prisma.scheduledJob.delete({ where: { id: jobId } });
  },

  /**
   * Run a job - AI-powered execution
   */
  runJob: async (jobId: string, retryCount = 0): Promise<any> => {
    const execution = await prisma.jobExecution.create({
      data: {
        jobId,
        status: 'running',
        retryCount,
      },
    });

    try {
      // 1. Load job with user info
      const job = await prisma.scheduledJob.findUnique({
        where: { id: jobId },
        include: { user: true },
      });
      if (!job) throw new Error('Job not found');

      // 2. Call AI with the job's prompt
      const startTime = Date.now();
      const aiResponse = await executeAIPrompt(job.userId, job.prompt);
      const latency = `${Date.now() - startTime}ms`;

      // 3. Save AI response as execution result
      return await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          result: aiResponse.content, // AI's full response
          latency,
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      // Retry logic
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((res) => setTimeout(res, delay));
        return await JobService.runJob(jobId, retryCount + 1);
      }

      return await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          result: `Error: ${error.message}`,
          completedAt: new Date(),
        },
      });
    } finally {
      await prisma.scheduledJob.update({
        where: { id: jobId },
        data: { lastRunAt: new Date() },
      });
    }
  },
};
