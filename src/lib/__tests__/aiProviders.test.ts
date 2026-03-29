// jest.mock() calls are hoisted, so we must define factories inline.
// We use jest.requireMock() after the fact to get references to the mock fns.

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'mock response' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'mock response', tool_calls: undefined } }],
        }),
      },
    },
  })),
}));

jest.mock('@google/generative-ai', () => ({
  __esModule: true,
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            candidates: [{ content: { parts: [{ text: 'mock response' }] } }],
          },
        }),
      }),
    }),
  })),
}));

import { generateAIResponse, type AIMessage, type AITool, type AIOverride } from '../aiProviders';

// Get references to the hoisted mock constructors
const MockAnthropic: jest.Mock = jest.requireMock('@anthropic-ai/sdk').default;
const MockOpenAI: jest.Mock = jest.requireMock('openai').default;
const MockGoogleGenerativeAI: jest.Mock = jest.requireMock('@google/generative-ai').GoogleGenerativeAI;

const sampleMessages: AIMessage[] = [{ role: 'user', content: 'What is the total revenue?' }];
const sampleTools: AITool[] = [];
const systemPrompt = 'You are a helpful assistant.';

// Helper to temporarily set / delete env vars and restore after
function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  return async () => {
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(vars)) {
      saved[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      await fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };
}

describe('generateAIResponse — provider routing via env', () => {
  it('routes to Anthropic when AI_PROVIDER=anthropic', withEnv(
    { AI_PROVIDER: 'anthropic', AI_API_KEY: 'sk-ant-test' },
    async () => {
      const result = await generateAIResponse(systemPrompt, sampleMessages, sampleTools);
      expect(result.content).toBe('mock response');
      expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'sk-ant-test' });
    }
  ));

  it('routes to OpenAI when AI_PROVIDER=openai', withEnv(
    { AI_PROVIDER: 'openai', AI_API_KEY: 'sk-openai-test' },
    async () => {
      const result = await generateAIResponse(systemPrompt, sampleMessages, sampleTools);
      expect(result.content).toBe('mock response');
      expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-openai-test' });
    }
  ));

  it('routes to Google when AI_PROVIDER=google', withEnv(
    { AI_PROVIDER: 'google', AI_API_KEY: 'goog-test-key' },
    async () => {
      const result = await generateAIResponse(systemPrompt, sampleMessages, sampleTools);
      expect(result.content).toBe('mock response');
      expect(MockGoogleGenerativeAI).toHaveBeenCalledWith('goog-test-key');
    }
  ));

  it('defaults to OpenAI when AI_PROVIDER is not set', withEnv(
    { AI_PROVIDER: undefined, AI_API_KEY: 'sk-openai-fallback' },
    async () => {
      const result = await generateAIResponse(systemPrompt, sampleMessages, sampleTools);
      expect(result.content).toBe('mock response');
      expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'sk-openai-fallback' });
    }
  ));

  it('throws a user-friendly error when AI_API_KEY is missing', withEnv(
    { AI_PROVIDER: 'openai', AI_API_KEY: undefined },
    async () => {
      await expect(generateAIResponse(systemPrompt, sampleMessages, sampleTools))
        .rejects.toThrow('No AI key configured');

      await expect(generateAIResponse(systemPrompt, sampleMessages, sampleTools))
        .rejects.toThrow(/Settings/);
    }
  ));
});

describe('generateAIResponse — override parameter', () => {
  it('uses override anthropic provider when override is supplied', withEnv(
    { AI_API_KEY: undefined },
    async () => {
      const override: AIOverride = {
        provider: 'anthropic',
        apiKey: 'override-ant-key',
        model: 'claude-3-5-haiku-20241022',
      };

      const result = await generateAIResponse(systemPrompt, sampleMessages, sampleTools, override);
      expect(result.content).toBe('mock response');
      expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'override-ant-key' });
    }
  ));

  it('override with openai provider calls OpenAI constructor with override apiKey', async () => {
    const override: AIOverride = {
      provider: 'openai',
      apiKey: 'override-oai-key',
      model: 'gpt-4o-mini',
    };

    await generateAIResponse(systemPrompt, sampleMessages, sampleTools, override);
    expect(MockOpenAI).toHaveBeenCalledWith({ apiKey: 'override-oai-key' });
  });

  it('override with google provider calls GoogleGenerativeAI with override apiKey', async () => {
    const override: AIOverride = {
      provider: 'google',
      apiKey: 'override-goog-key',
      model: 'gemini-1.5-flash',
    };

    await generateAIResponse(systemPrompt, sampleMessages, sampleTools, override);
    expect(MockGoogleGenerativeAI).toHaveBeenCalledWith('override-goog-key');
  });
});

describe('generateAIResponse — tool calls', () => {
  it('returns toolCalls when Anthropic responds with tool_use blocks', withEnv(
    { AI_PROVIDER: 'anthropic', AI_API_KEY: 'sk-test' },
    async () => {
      MockAnthropic.mockImplementationOnce(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              { type: 'tool_use', id: 'tool_001', name: 'get_invoices', input: { limit: 10 } },
            ],
            stop_reason: 'tool_use',
          }),
        },
      }));

      const result = await generateAIResponse(systemPrompt, sampleMessages, sampleTools);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('get_invoices');
      expect(result.toolCalls![0].input).toEqual({ limit: 10 });
    }
  ));

  it('returns toolCalls when OpenAI responds with tool_calls', withEnv(
    { AI_PROVIDER: 'openai', AI_API_KEY: 'sk-test' },
    async () => {
      MockOpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: null,
                  tool_calls: [{
                    id: 'call_001',
                    function: { name: 'get_customers', arguments: '{"limit":5}' },
                  }],
                },
              }],
            }),
          },
        },
      }));

      const result = await generateAIResponse(systemPrompt, sampleMessages, sampleTools);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].name).toBe('get_customers');
      expect(result.toolCalls![0].input).toEqual({ limit: 5 });
    }
  ));
});

describe('generateAIResponse — tool role message normalization', () => {
  it('normalizes tool role messages to user role for Anthropic', withEnv(
    { AI_PROVIDER: 'anthropic', AI_API_KEY: 'sk-test' },
    async () => {
      const messagesWithTool: AIMessage[] = [
        { role: 'user', content: 'List invoices' },
        { role: 'assistant', content: '' },
        { role: 'tool', content: '{"invoices":[]}', _toolCallId: 'tc_001' },
      ];

      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Here are your invoices' }],
      });

      MockAnthropic.mockImplementationOnce(() => ({
        messages: { create: mockCreate },
      }));

      await generateAIResponse(systemPrompt, messagesWithTool, sampleTools);

      const calledMessages = mockCreate.mock.calls[0][0].messages;
      expect(calledMessages.some((m: any) => m.role === 'tool')).toBe(false);
      expect(calledMessages.some((m: any) => m.role === 'user' && m.content.includes('tc_001'))).toBe(true);
    }
  ));
});
