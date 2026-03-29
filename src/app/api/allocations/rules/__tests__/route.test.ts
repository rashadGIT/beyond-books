// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

const MOCK_RULE = {
  id: 'rule-1',
  userId: 'test-user-id',
  name: '50/50 Split',
  splits: [
    { id: 'sp-1', programId: 'prog-1', percentage: 50, program: { name: 'Education' } },
    { id: 'sp-2', programId: 'prog-2', percentage: 50, program: { name: 'Health' } },
  ],
  createdAt: new Date(),
};

describe('GET /api/allocations/rules', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/allocations/rules');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns rules array on success', async () => {
    (prisma.allocationRule.findMany as jest.Mock).mockResolvedValueOnce([MOCK_RULE]);

    const req = new NextRequest('http://localhost/api/allocations/rules', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe('50/50 Split');
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.allocationRule.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/allocations/rules', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/allocations/rules', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/allocations/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', splits: [{ programId: 'p1', percentage: 100 }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (empty splits)', async () => {
    const req = new NextRequest('http://localhost/api/allocations/rules', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: 'Test', splits: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when splits do not sum to 100', async () => {
    const req = new NextRequest('http://localhost/api/allocations/rules', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        name: 'Bad Split',
        splits: [
          { programId: 'p1', percentage: 60 },
          { programId: 'p2', percentage: 30 },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/sum to 100/);
  });

  it('returns 201 with created rule on success', async () => {
    (prisma.allocationRule.create as jest.Mock).mockResolvedValueOnce(MOCK_RULE);

    const req = new NextRequest('http://localhost/api/allocations/rules', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        name: '50/50 Split',
        splits: [
          { programId: 'prog-1', percentage: 50 },
          { programId: 'prog-2', percentage: 50 },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect((await res.json()).name).toBe('50/50 Split');
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.allocationRule.create as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/allocations/rules', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        name: 'Split',
        splits: [{ programId: 'p1', percentage: 100 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/allocations/rules', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/allocations/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'rule-1' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful deletion', async () => {
    (prisma.allocationRule.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

    const req = new NextRequest('http://localhost/api/allocations/rules', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ id: 'rule-1' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
