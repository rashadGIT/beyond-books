// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    getSalesReceiptsForConnection: jest.fn().mockResolvedValue({
      QueryResponse: {
        SalesReceipt: [
          { Id: 'sr-1', TotalAmt: 100, BillEmail: { Address: 'alice@example.com' }, CustomerRef: { value: 'c1' } },
        ],
      },
    }),
    queryForConnection: jest.fn().mockResolvedValue({ QueryResponse: { Customer: [] } }),
  }),
}));

describe('GET /api/ledger/sales-receipts', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/ledger/sales-receipts');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when QuickBooks is not connected', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/ledger/sales-receipts', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with receipts array on success', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });

    const req = new NextRequest('http://localhost/api/ledger/sales-receipts', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.receipts)).toBe(true);
  });

  it('returns 200 with date range params', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });

    const req = new NextRequest('http://localhost/api/ledger/sales-receipts?start=2024-01-01&end=2024-12-31', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns 500 when QB service throws', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
    });
    const { getQuickBooksService } = require('@/lib/quickbooksService');
    getQuickBooksService.mockReturnValueOnce({
      getSalesReceiptsForConnection: jest.fn().mockRejectedValueOnce(new Error('QB error')),
      queryForConnection: jest.fn(),
    });

    const req = new NextRequest('http://localhost/api/ledger/sales-receipts', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
