import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAIResponse, AIMessage, AIOverride } from '@/lib/aiProviders';
import type { AITool } from '@/lib/aiProviders';
import { createQbMcpClient } from '@/lib/qbMcpExecutor';
import { JobService } from '@/lib/jobService';
import { PDFService } from '@/lib/pdfService';

function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isoDate = new Date().toISOString().slice(0, 10);
  return `You are a helpful financial assistant for nonprofit and small business accounting.
You have access to the user's QuickBooks data through tools.
When asked about finances, donors, transactions, customers, invoices, or payments, use the available tools to look up real data before answering.
Present numbers clearly, use plain English, and offer actionable insights where helpful.
If QuickBooks is not connected, let the user know they can connect it in Settings.
If a tool call fails or returns an error, include the exact error message in your response so the user can diagnose the problem. Do not give a vague "I'm unable to connect" message — quote the actual error text.

QuickBooks IDS query language limitations for run_custom_query: only supports WHERE operators =, !=, LIKE, IN, BETWEEN, CONTAINS. It does NOT support > or < comparisons. To find unpaid invoices (Balance > 0), use the get_unpaid_invoices tool instead of a custom query.

You can also schedule recurring AI tasks for this user using the create_scheduled_job tool. When someone asks you to schedule, automate, or set up a recurring report or query, use create_scheduled_job directly — do NOT tell them to set it up manually in QuickBooks. Ask for frequency (DAILY, WEEKLY, HOURLY) and time of day if not provided, then call the tool.
You can also run an existing scheduled task immediately using the run_scheduled_job tool. When the user asks to run, execute, or trigger a task by name, use this tool with the task label.
You can generate a downloadable PDF report using the generate_report_pdf tool. When the user asks to save results as a PDF or download a report, call this tool with the report title and the full content you want in the PDF.

Today's date is ${today} (${isoDate}). Use this when interpreting relative dates like "this month", "last month", "this year", "recent", etc.`;
}

const CREATE_SCHEDULED_JOB_TOOL: AITool = {
  name: 'create_scheduled_job',
  description: 'Schedule a recurring AI task that runs automatically on a set schedule. Use this when the user asks to schedule, automate, or set up a recurring report or query.',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'A short friendly name for the task (e.g. "Weekly Donor Summary")' },
      prompt: { type: 'string', description: 'The AI prompt to run on schedule (e.g. "Show me all donations from last week")' },
      frequency: { type: 'string', enum: ['HOURLY', 'DAILY', 'WEEKLY'], description: 'How often to run' },
      schedule: { type: 'string', description: 'Time of day to run, e.g. "09:00 AM"' },
    },
    required: ['label', 'prompt', 'frequency', 'schedule'],
  },
};

const GENERATE_PDF_TOOL: AITool = {
  name: 'generate_report_pdf',
  description: 'Generate a downloadable PDF report from the current data or analysis. Use this when the user asks to save or download the results as a PDF file.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the PDF report (e.g. "Top Donors 2026")' },
      content: { type: 'string', description: 'The full report content in plain text or markdown to include in the PDF' },
    },
    required: ['title', 'content'],
  },
};

const RUN_SCHEDULED_JOB_TOOL: AITool = {
  name: 'run_scheduled_job',
  description: 'Run a scheduled task immediately by its name. Use this when the user asks to run, execute, or trigger a scheduled task by name.',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'The exact name of the scheduled task to run (e.g. "Weekly Donor Summary")' },
    },
    required: ['label'],
  },
};

const MAX_TOOL_ITERATIONS = 5;

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { timestamp: 'asc' },
    });
    return NextResponse.json(messages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { role, content, fileId } = await request.json();

    // Ensure user record exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@unknown.local`,
        name: request.headers.get('x-user-name') || undefined,
      },
    });

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: { userId, role, content, hasAttachment: !!fileId, fileId },
    });

    if (role !== 'user') {
      return NextResponse.json(userMessage);
    }

    // Load recent conversation history (last 20 messages)
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    const messages: AIMessage[] = history
      .reverse()
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Build in-process MCP client if QB is connected — dynamic tool discovery, no static list
    const qbConnection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    const mcpClient = qbConnection ? await createQbMcpClient(qbConnection) : null;
    const qbTools: AITool[] = mcpClient
      ? (await mcpClient.listTools()).tools.map(t => ({
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema as AITool['inputSchema'],
        }))
      : [];
    const tools: AITool[] = [...qbTools, CREATE_SCHEDULED_JOB_TOOL, RUN_SCHEDULED_JOB_TOOL, GENERATE_PDF_TOOL];

    // Load user's personal AI settings if they have one saved
    const userAISettings = await prisma.aISettings.findFirst({ where: { userId, isActive: true } });
    const aiOverride: AIOverride | undefined = userAISettings
      ? { provider: userAISettings.provider as AIOverride['provider'], apiKey: userAISettings.apiKey, model: userAISettings.model }
      : undefined;

    // Agentic loop: call AI → execute tools → call AI again → repeat until no more tool calls
    let finalContent = '';
    let iterationCount = 0;
    const loopMessages = [...messages];

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
      const MAX_RESULT_CHARS = 12_000;

      for (const toolCall of aiResponse.toolCalls) {
        let resultContent: string;

        if (toolCall.name === 'generate_report_pdf') {
          try {
            const input = toolCall.input as { title: string; content: string };
            const fileName = await PDFService.generateReportPDF(input.title, input.content);
            resultContent = `PDF generated successfully. [Download "${input.title}"]( /api/reports/pdf?file=${encodeURIComponent(fileName)})`;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            resultContent = `Failed to generate PDF: ${msg}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'run_scheduled_job') {
          try {
            const input = toolCall.input as { label: string };
            const job = await prisma.scheduledJob.findFirst({
              where: { userId, label: input.label },
            });
            if (!job) {
              resultContent = `No scheduled task named "${input.label}" found. Check the task name and try again.`;
            } else {
              const execution = await JobService.runJob(job.id);
              resultContent = execution.status === 'completed'
                ? `Task "${job.label}" ran successfully.\n\n${execution.result}`
                : `Task "${job.label}" failed: ${execution.result}`;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            resultContent = `Failed to run scheduled task: ${msg}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'create_scheduled_job') {
          try {
            const input = toolCall.input as { label: string; prompt: string; frequency: string; schedule: string };
            const job = await JobService.createJob(userId, {
              label: input.label,
              prompt: input.prompt,
              frequency: input.frequency,
              schedule: input.schedule,
            });
            resultContent = `Scheduled job created successfully. Job ID: ${job.id}. Label: "${job.label}". Runs ${job.frequency?.toLowerCase()} at ${job.schedule}.`;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            resultContent = `Failed to create scheduled job: ${msg}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

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
          const rawText = (resultObj.content as Array<{ type: string; text: string }>)?.[0]?.text
            ?? JSON.stringify(resultObj);
          const truncated = rawText.length > MAX_RESULT_CHARS
            ? rawText.slice(0, MAX_RESULT_CHARS) + '\n... [truncated — too many results]'
            : rawText;
          resultContent = `Tool "${toolCall.name}" result:\n${truncated}`;
        } catch (toolErr) {
          const msg = toolErr instanceof Error ? toolErr.message : String(toolErr);
          console.error(`[chat/mcp] Tool "${toolCall.name}" error:`, msg);
          resultContent = `Tool "${toolCall.name}" failed: ${msg}`;
        }

        toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
      }

      // Append AI's tool-use turn (with raw tool_calls for OpenAI) and individual tool results
      loopMessages.push({
        role: 'assistant',
        content: aiResponse.content || '',
        _toolCallsRaw: aiResponse.toolCalls.map(tc => ({
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

    const assistantMessage = await prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: finalContent },
    });

    return NextResponse.json({ userMessage, assistantMessage });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.chatMessage.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
