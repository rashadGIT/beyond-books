// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/schedulerService', () => ({
  scheduler: {
    initializeUserJobs: jest.fn().mockResolvedValue(undefined),
    getActiveSchedules: jest.fn().mockReturnValue([{ id: 'schedule-1' }, { id: 'schedule-2' }]),
  },
}));

const CRON_SECRET = 'super-secret-cron-token';

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET;
});

describe('POST /api/scheduler/init', () => {
  it('returns 401 when authorization header is missing', async () => {
    const req = new NextRequest('http://localhost/api/scheduler/init', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('returns 401 when authorization header has wrong secret', async () => {
    const req = new NextRequest('http://localhost/api/scheduler/init', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/scheduler/init', {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with scheduled job count when auth is correct', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    const req = new NextRequest('http://localhost/api/scheduler/init', {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.users).toBe(2);
    expect(typeof body.scheduledJobs).toBe('number');
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.user.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/scheduler/init', {
      method: 'POST',
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
