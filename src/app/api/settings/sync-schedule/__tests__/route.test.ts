// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/schedulerService', () => ({
  scheduler: {
    scheduleQbSyncJob: jest.fn(),
    unscheduleQbSyncJob: jest.fn(),
    getActiveSchedules: jest.fn().mockReturnValue([]),
    initializeUserJobs: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/cronUtils', () => ({
  parseScheduleToCron: jest.fn().mockReturnValue('0 9 * * *'),
}));

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

describe('GET /api/settings/sync-schedule', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/sync-schedule');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns default state when no connection exists', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).autoSyncEnabled).toBe(false);
  });

  it('returns sync settings when connection exists', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      autoSyncEnabled: true,
      autoSyncCron: '0 9 * * *',
    });

    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.autoSyncEnabled).toBe(true);
    expect(body.autoSyncCron).toBe('0 9 * * *');
  });
});

describe('POST /api/settings/sync-schedule', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (invalid frequency)', async () => {
    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ enabled: true, frequency: 'MONTHLY', schedule: '09:00 AM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 404 when no QB connection found', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ enabled: true, schedule: '09:00 AM', frequency: 'DAILY' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when enabling without schedule and frequency', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'conn-1',
      userId: 'test-user-id',
      autoSyncEnabled: false,
      autoSyncCron: null,
    });

    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ enabled: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/schedule and frequency are required/);
  });

  it('returns 200 when enabling auto-sync', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'conn-1',
      userId: 'test-user-id',
      autoSyncEnabled: false,
      autoSyncCron: null,
    });
    (prisma.quickBooksConnection.update as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ enabled: true, schedule: '09:00 AM', frequency: 'DAILY' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.autoSyncEnabled).toBe(true);
  });

  it('returns 200 when disabling auto-sync', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'conn-1',
      userId: 'test-user-id',
      autoSyncEnabled: true,
      autoSyncCron: '0 9 * * *',
    });
    (prisma.quickBooksConnection.update as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/settings/sync-schedule', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ enabled: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).autoSyncEnabled).toBe(false);
  });
});
