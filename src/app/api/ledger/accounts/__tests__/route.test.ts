// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    getAccountsForConnection: jest.fn().mockResolvedValue({
      QueryResponse: {
        Account: [
          { Id: '1', Name: 'Checking', AccountType: 'Bank' },
        ],
      },
    }),
  }),
}));

describe('GET /api/ledger/accounts', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/ledger/accounts');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when QuickBooks is not connected', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/ledger/accounts', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/QuickBooks not connected/);
  });

  it('returns 400 when connection is inactive', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({ userId: 'test-user-id', isActive: false });

    const req = new NextRequest('http://localhost/api/ledger/accounts', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns accounts array on success', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
      accessToken: 'tok',
      realmId: 'realm',
    });

    const req = new NextRequest('http://localhost/api/ledger/accounts', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns 500 when QB service throws', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });
    const { getQuickBooksService } = require('@/lib/quickbooksService');
    getQuickBooksService.mockReturnValueOnce({
      getAccountsForConnection: jest.fn().mockRejectedValueOnce(new Error('QB error')),
    });

    const req = new NextRequest('http://localhost/api/ledger/accounts', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
