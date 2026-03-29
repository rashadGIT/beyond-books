// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

describe('GET /api/letters/history', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/letters/history');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with logs array on success', async () => {
    (prisma.emailLog.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'log-1', recipient: 'alice@example.com', status: 'sent', sentAt: new Date() },
    ]);

    const req = new NextRequest('http://localhost/api/letters/history', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.logs)).toBe(true);
    expect(body.logs[0].id).toBe('log-1');
  });

  it('returns empty logs array when no history exists', async () => {
    (prisma.emailLog.findMany as jest.Mock).mockResolvedValueOnce([]);

    const req = new NextRequest('http://localhost/api/letters/history', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).logs).toHaveLength(0);
  });
});
