import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAIResponse, AIMessage, AIOverride } from '@/lib/aiProviders';
import type { AITool } from '@/lib/aiProviders';
import { createQbMcpClient } from '@/lib/qbMcpExecutor';
import { JobService } from '@/lib/jobService';

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

You also have the ability to create scheduled reports for the user using the create_scheduled_job tool.
When a user asks you to schedule, automate, or set up a recurring report or task — use the create_scheduled_job tool to create it for them immediately. Do NOT tell the user to set up schedules manually anywhere. You handle scheduling directly.
After creating a job, confirm to the user what was scheduled, how often it will run, and what it will report on.

Today's date is ${today} (${isoDate}). Use this when interpreting relative dates like "this month", "last month", "this year", "recent", etc.`;
}

const CREATE_SCHEDULED_JOB_TOOL: AITool = {
  name: 'create_scheduled_job',
  description: 'Create a recurring scheduled report or task that runs automatically. Use this whenever the user asks to schedule, automate, or set up a recurring report. Do not tell the user to do this manually.',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: "Short friendly name, e.g. 'Weekly Donor Summary'" },
      prompt: { type: 'string', description: "The AI prompt that will run on schedule, e.g. 'Summarize all payments received this week and list the top 5 donors by amount'" },
      frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'HOURLY'], description: 'How often to run' },
      schedule: { type: 'string', description: "Time to run in 12-hour format, e.g. '09:00 AM'" },
    },
    required: ['label', 'prompt', 'frequency', 'schedule'],
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
    const tools: AITool[] = [...qbTools, CREATE_SCHEDULED_JOB_TOOL];

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

        // Handle Beyond Books native tools first
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
