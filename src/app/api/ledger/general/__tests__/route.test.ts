// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    getGeneralLedgerForConnection: jest.fn().mockResolvedValue({ Rows: { Row: [] } }),
  }),
}));

function makeRequest(params = '', userId = 'test-user-id') {
  return new NextRequest(`http://localhost/api/ledger/general${params}`, {
    headers: { 'x-user-id': userId },
  });
}

describe('GET /api/ledger/general', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/ledger/general');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when QuickBooks is not connected', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it('returns 200 with ledger data on success', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });

    const res = await GET(makeRequest('?start=2024-01-01&end=2024-12-31'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('Rows');
  });

  it('returns 200 using default date range when no params provided', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('returns 500 when QB service throws', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });
    const { getQuickBooksService } = require('@/lib/quickbooksService');
    getQuickBooksService.mockReturnValueOnce({
      getGeneralLedgerForConnection: jest.fn().mockRejectedValueOnce(new Error('QB error')),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
