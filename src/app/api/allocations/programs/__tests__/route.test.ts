// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

const MOCK_PROGRAM = {
  id: 'prog-1',
  userId: 'test-user-id',
  name: 'Education',
  type: 'PROGRAM',
  isActive: true,
  createdAt: new Date(),
};

describe('GET /api/allocations/programs', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/allocations/programs');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns programs array on success', async () => {
    (prisma.program.findMany as jest.Mock).mockResolvedValueOnce([MOCK_PROGRAM]);

    const req = new NextRequest('http://localhost/api/allocations/programs', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe('Education');
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.program.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/allocations/programs', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/allocations/programs', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/allocations/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Education', type: 'PROGRAM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (missing name)', async () => {
    const req = new NextRequest('http://localhost/api/allocations/programs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ type: 'PROGRAM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when type is invalid', async () => {
    const req = new NextRequest('http://localhost/api/allocations/programs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: 'Education', type: 'INVALID_TYPE' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/type must be one of/);
  });

  it('returns 201 with created program on success', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (prisma.program.create as jest.Mock).mockResolvedValueOnce(MOCK_PROGRAM);

    const req = new NextRequest('http://localhost/api/allocations/programs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: 'Education', type: 'PROGRAM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect((await res.json()).name).toBe('Education');
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (prisma.program.create as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/allocations/programs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ name: 'Education', type: 'PROGRAM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/allocations/programs', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/allocations/programs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'prog-1' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful soft delete', async () => {
    (prisma.program.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

    const req = new NextRequest('http://localhost/api/allocations/programs', {
      method: 'DELETE',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ id: 'prog-1' }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
