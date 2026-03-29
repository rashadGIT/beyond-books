// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, PUT, PATCH, DELETE } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'x-user-email': 'test@example.com',
  'Content-Type': 'application/json',
};

const MOCK_SETTING = {
  id: 's1',
  userId: 'test-user-id',
  provider: 'anthropic',
  apiKey: 'sk-ant-test-key-1234',
  model: 'claude-3-5-sonnet',
  isActive: true,
};

describe('GET /api/settings/ai', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns array of masked AI settings on success', async () => {
    (prisma.aISettings.findMany as jest.Mock).mockResolvedValueOnce([MOCK_SETTING]);

    const req = new NextRequest('http://localhost/api/settings/ai', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].provider).toBe('anthropic');
    expect(body[0].maskedKey).toBeDefined();
    expect(body[0].maskedKey).not.toBe('sk-ant-test-key-1234');
  });
});

describe('PUT /api/settings/ai', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'key', model: 'model' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (invalid provider)', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'PUT',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'invalid-provider', apiKey: 'key', model: 'model' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when apiKey is empty', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'PUT',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'anthropic', apiKey: '', model: 'claude-3-5-sonnet' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with masked key on success', async () => {
    (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.aISettings.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
    (prisma.aISettings.upsert as jest.Mock).mockResolvedValueOnce(MOCK_SETTING);

    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'PUT',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'anthropic', apiKey: 'sk-ant-key-1234', model: 'claude-3-5-sonnet' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe('anthropic');
    expect(body.maskedKey).not.toBe('sk-ant-test-key-1234');
  });
});

describe('PATCH /api/settings/ai', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when provider is invalid', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'PATCH',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'bad-provider' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful provider activation', async () => {
    (prisma.aISettings.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.aISettings.update as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'PATCH',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'openai' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

describe('DELETE /api/settings/ai', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'anthropic' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when provider is invalid', async () => {
    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'bad-provider' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful deletion', async () => {
    (prisma.aISettings.delete as jest.Mock).mockResolvedValueOnce({ ...MOCK_SETTING, isActive: false });

    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'anthropic' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('activates next provider when active provider is deleted', async () => {
    (prisma.aISettings.delete as jest.Mock).mockResolvedValueOnce({ ...MOCK_SETTING, isActive: true });
    (prisma.aISettings.findFirst as jest.Mock).mockResolvedValueOnce({ id: 's2', provider: 'openai' });
    (prisma.aISettings.update as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/settings/ai', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'anthropic' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(prisma.aISettings.update).toHaveBeenCalled();
  });
});
