// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    getTrialBalanceForConnection: jest.fn().mockResolvedValue({ Rows: { Row: [] } }),
  }),
}));

describe('GET /api/ledger/trial-balance', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/ledger/trial-balance');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when QuickBooks is not connected', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/ledger/trial-balance', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with trial balance data on success', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });

    const req = new NextRequest('http://localhost/api/ledger/trial-balance?start=2024-01-01&end=2024-12-31', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('Rows');
  });

  it('returns 500 when QB service throws', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });
    const { getQuickBooksService } = require('@/lib/quickbooksService');
    getQuickBooksService.mockReturnValueOnce({
      getTrialBalanceForConnection: jest.fn().mockRejectedValueOnce(new Error('QB error')),
    });

    const req = new NextRequest('http://localhost/api/ledger/trial-balance', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
