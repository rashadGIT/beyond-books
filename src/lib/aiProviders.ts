import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type AIProvider = 'anthropic' | 'openai' | 'google';

export interface AIMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  // Carried internally for OpenAI multi-turn tool loops; ignored by Anthropic/Google adapters
  _toolCallId?: string;
  _toolCallsRaw?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

export interface AITool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

function getProviderConfig(): { provider: AIProvider; apiKey: string; model: string | undefined } | null {
  const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!apiKey) throw new Error('No AI key configured. Go to Settings → AI Configuration and add your API key.');

  return { provider, apiKey, model };
}

export interface AIOverride {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export async function generateAIResponse(
  systemPrompt: string,
  messages: AIMessage[],
  tools: AITool[],
  override?: AIOverride
): Promise<AIResponse> {
  const config = override ?? getProviderConfig();
  if (!config) {
    throw new Error('No AI key configured. Go to Settings → AI Configuration and add your API key.');
  }
  const { provider, apiKey, model } = config;

  switch (provider) {
    case 'anthropic':
      return callAnthropic(apiKey, model, systemPrompt, messages, tools);
    case 'openai':
      return callOpenAI(apiKey, model, systemPrompt, messages, tools);
    case 'google':
      return callGoogle(apiKey, model, systemPrompt, messages, tools);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

async function callAnthropic(
  apiKey: string,
  model: string | undefined,
  systemPrompt: string,
  messages: AIMessage[],
  tools: AITool[]
): Promise<AIResponse> {
  const client = new Anthropic({ apiKey });

  // Normalize: Anthropic only accepts user/assistant roles; tool results become user messages
  const normalizedMessages = messages.map(m => ({
    role: (m.role === 'tool' ? 'user' : m.role) as 'user' | 'assistant',
    content: m.role === 'tool' ? `Tool result (id: ${m._toolCallId}):\n${m.content}` : m.content,
  }));

  const response = await client.messages.create({
    model: model || 'claude-opus-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: normalizedMessages,
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    })),
  });

  const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
  const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

  return {
    content: textBlocks.map(b => b.text).join(''),
    toolCalls: toolUseBlocks.map(b => ({
      id: b.id,
      name: b.name,
      input: b.input as Record<string, unknown>,
    })),
  };
}

async function callOpenAI(
  apiKey: string,
  model: string | undefined,
  systemPrompt: string,
  messages: AIMessage[],
  tools: AITool[]
): Promise<AIResponse> {
  const client = new OpenAI({ apiKey });

  // Convert unified AIMessage format to OpenAI's strict multi-turn format
  const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: m._toolCallId!,
          content: m.content,
        };
      }
      if (m._toolCallsRaw && m._toolCallsRaw.length > 0) {
        return {
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: m._toolCallsRaw,
        };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    }),
  ];

  const response = await client.chat.completions.create({
    model: model || 'gpt-4o',
    messages: openAIMessages,
    tools: tools.length > 0 ? tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    })) : undefined,
  });

  const msg = response.choices[0].message;
  return {
    content: msg.content || '',
    toolCalls: msg.tool_calls?.map(tc => ({
      id: tc.id,
      name: (tc as any).function.name as string,
      input: JSON.parse((tc as any).function.arguments) as Record<string, unknown>,
    })),
  };
}

async function callGoogle(
  apiKey: string,
  model: string | undefined,
  systemPrompt: string,
  messages: AIMessage[],
  tools: AITool[]
): Promise<AIResponse> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-pro',
    systemInstruction: systemPrompt,
  });

  // Normalize: Google only accepts user/model roles; tool results become user messages
  const normalizedMessages = messages.map(m => ({
    role: m.role === 'tool' ? 'user' : m.role,
    content: m.role === 'tool' ? `Tool result: ${m.content}` : m.content,
  }));

  const history = normalizedMessages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = geminiModel.startChat({
    history,
    tools: tools.length > 0 ? [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as any,
      })),
    }] : undefined,
  });

  const lastMessage = normalizedMessages[normalizedMessages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;

  const parts = response.candidates?.[0]?.content?.parts || [];
  const textParts = parts.filter(p => p.text);
  const fnParts = parts.filter(p => p.functionCall);

  return {
    content: textParts.map(p => p.text).join(''),
    toolCalls: fnParts.map((p, i) => ({
      id: `google_fn_${Date.now()}_${i}`,
      name: p.functionCall!.name,
      input: p.functionCall!.args as Record<string, unknown>,
    })),
  };
}
