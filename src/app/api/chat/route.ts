import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAIResponse, AIMessage, AIOverride } from '@/lib/aiProviders';
import { QB_TOOLS } from '@/app/api/mcp/route';

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

Today's date is ${today} (${isoDate}). Use this when interpreting relative dates like "this month", "last month", "this year", "recent", etc.`;
}

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

    // Check if QB is connected — only pass tools if it is
    const qbConnection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    const tools = qbConnection ? QB_TOOLS : [];

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

      // Execute each tool call via the MCP route
      const toolResults: Array<{ id: string; name: string; content: string }> = [];

      for (const toolCall of aiResponse.toolCalls) {
        let resultContent: string;
        try {
          const mcpRes = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/mcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
            },
            body: JSON.stringify({ tool: toolCall.name, input: toolCall.input }),
          });

          const mcpData = await mcpRes.json();

          if (mcpData.error) {
            console.error(`[chat] Tool "${toolCall.name}" error:`, mcpData.error);
            resultContent = `Tool "${toolCall.name}" failed: ${mcpData.error}`;
          } else {
            console.log(`[chat] Tool "${toolCall.name}" succeeded, result keys:`, Object.keys(mcpData.result || {}));
            const resultStr = JSON.stringify(mcpData.result, null, 2);
            // Cap at ~12 000 chars (~3 000 tokens) to stay within model context limits
            const MAX_RESULT_CHARS = 12_000;
            const truncated = resultStr.length > MAX_RESULT_CHARS
              ? resultStr.slice(0, MAX_RESULT_CHARS) + '\n... [truncated — too many results]'
              : resultStr;
            resultContent = `Tool "${toolCall.name}" result:\n${truncated}`;
          }
        } catch (toolErr: any) {
          console.error(`[chat] Tool "${toolCall.name}" fetch error:`, toolErr?.message);
          resultContent = `Tool "${toolCall.name}" encountered an error: ${toolErr?.message}`;
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
