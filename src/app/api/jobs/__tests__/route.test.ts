// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../route';

jest.mock('@/lib/jobService', () => ({
  JobService: {
    getScheduledJobs: jest.fn().mockResolvedValue([
      { id: 'job-1', label: 'Weekly Report', prompt: 'Show weekly donors', schedule: '09:00 AM' },
    ]),
    getExecutions: jest.fn().mockResolvedValue([]),
    createJob: jest.fn().mockResolvedValue({ id: 'job-2', label: 'New Job' }),
    runJob: jest.fn().mockResolvedValue({ id: 'exec-1', status: 'completed' }),
    deleteJob: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/schedulerService', () => ({
  scheduler: {
    initializeUserJobs: jest.fn().mockResolvedValue(undefined),
    scheduleJob: jest.fn(),
    unscheduleJob: jest.fn(),
  },
}));

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

describe('GET /api/jobs', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/jobs');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns jobs and history on success', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('jobs');
    expect(body).toHaveProperty('history');
    expect(Array.isArray(body.jobs)).toBe(true);
  });

  it('returns 500 when service throws', async () => {
    const { JobService } = require('@/lib/jobService');
    JobService.getScheduledJobs.mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/jobs', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/jobs (create job)', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Show donors', label: 'Report', schedule: '09:00 AM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (missing label)', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ prompt: 'Show donors', schedule: '09:00 AM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 200 with created job on success', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ prompt: 'Show weekly donors', label: 'Weekly Report', schedule: '09:00 AM', frequency: 'WEEKLY' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
  });
});

describe('POST /api/jobs (run job)', () => {
  it('returns 400 when jobId is missing for run-job path', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 200 with execution on successful run', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ jobId: 'job-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id', 'exec-1');
  });
});

describe('DELETE /api/jobs', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-1' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful deletion', async () => {
    const req = new NextRequest('http://localhost/api/jobs', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ jobId: 'job-1' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
