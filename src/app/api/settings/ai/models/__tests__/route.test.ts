// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

describe('POST /api/settings/ai/models', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-key' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (invalid provider)', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai/models', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'bad-provider', apiKey: 'sk-key' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when apiKey is empty', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai/models', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'anthropic', apiKey: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with models list for Anthropic on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [
          { id: 'claude-3-5-sonnet-20241022' },
          { id: 'claude-3-opus-20240229' },
          { id: 'gpt-4' },
        ],
      }),
    });

    const req = new NextRequest('http://localhost/api/settings/ai/models', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-ant-key' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.models.every((m: string) => m.startsWith('claude-'))).toBe(true);
  });

  it('returns 400 when Anthropic API returns non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: jest.fn(),
    });

    const req = new NextRequest('http://localhost/api/settings/ai/models', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'bad-key' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid Anthropic/);
  });

  it('returns 200 with models list for OpenAI on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [
          { id: 'gpt-4o' },
          { id: 'gpt-4o-mini' },
          { id: 'gpt-3.5-turbo' },
        ],
      }),
    });

    const req = new NextRequest('http://localhost/api/settings/ai/models', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'openai', apiKey: 'sk-openai-key' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.models)).toBe(true);
  });

  it('returns 200 with models list for Google on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        models: [
          { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.0-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-bison', supportedGenerationMethods: ['generateText'] },
        ],
      }),
    });

    const req = new NextRequest('http://localhost/api/settings/ai/models', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'google', apiKey: 'google-key' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.models.every((m: string) => m.includes('gemini'))).toBe(true);
  });
});
