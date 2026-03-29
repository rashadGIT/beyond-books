// @jest-environment node
import { NextRequest } from 'next/server';
import { PATCH } from '../route';
import { prisma } from '../../../../../../__mocks__/prisma';

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    updateAccountForConnection: jest.fn().mockResolvedValue({ Id: 'acct-1', Name: 'Updated Name' }),
  }),
}));

function makeRequest(body: unknown, userId?: string) {
  return new NextRequest('http://localhost/api/ledger/accounts/acct-1', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/ledger/accounts/[id]', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const res = await PATCH(makeRequest({ name: 'New Name' }), { params: Promise.resolve({ id: 'acct-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (invalid field type)', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });

    const res = await PATCH(
      makeRequest({ active: 'not-a-boolean' }, 'test-user-id'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when QuickBooks is not connected', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await PATCH(
      makeRequest({ name: 'New Name' }, 'test-user-id'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/QuickBooks not connected/);
  });

  it('returns 200 with updated account on success', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });

    const res = await PATCH(
      makeRequest({ name: 'Updated Checking', description: 'Main account' }, 'test-user-id'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('Id', 'acct-1');
  });

  it('returns 500 when QB service throws', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });
    const { getQuickBooksService } = require('@/lib/quickbooksService');
    getQuickBooksService.mockReturnValueOnce({
      updateAccountForConnection: jest.fn().mockRejectedValueOnce(new Error('QB error')),
    });

    const res = await PATCH(
      makeRequest({ name: 'Test' }, 'test-user-id'),
      { params: Promise.resolve({ id: 'acct-1' }) }
    );
    expect(res.status).toBe(500);
  });
});
