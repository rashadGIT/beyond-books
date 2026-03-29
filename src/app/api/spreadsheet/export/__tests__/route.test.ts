// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    getInvoicesForConnection: jest.fn().mockResolvedValue({ QueryResponse: { Invoice: [] } }),
    getPaymentsForConnection: jest.fn().mockResolvedValue({ QueryResponse: { Payment: [] } }),
    getSalesReceiptsForConnection: jest.fn().mockResolvedValue({ QueryResponse: { SalesReceipt: [] } }),
  }),
}));

jest.mock('@/lib/excelService', () => ({
  ExcelService: {
    mapInvoiceToRow: jest.fn((x) => x),
    mapPaymentToRow: jest.fn((x) => x),
    mapSalesReceiptToRow: jest.fn((x) => x),
    generateExcel: jest.fn().mockReturnValue(Buffer.from('xlsx-data')),
    generateCSV: jest.fn().mockReturnValue('col1,col2\nval1,val2'),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/spreadsheet/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user-1',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/spreadsheet/export', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/spreadsheet/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataType: 'invoices' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (missing dataType)', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when dataType is invalid', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({ userId: 'user-1', isActive: true });

    const res = await POST(makeRequest({ dataType: 'bad_type' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid dataType/);
  });

  it('returns 400 when QuickBooks is not connected', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ dataType: 'invoices' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/QuickBooks not connected/);
  });

  it('returns 200 with downloadUrl on successful export', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'user-1',
      isActive: true,
      accessToken: 'tok',
      realmId: 'realm',
    });

    const res = await POST(makeRequest({ dataType: 'invoices', format: 'xlsx' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('downloadUrl');
    expect(body).toHaveProperty('recordCount');
  });

  it('returns 200 with CSV export when format=csv', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'user-1',
      isActive: true,
      accessToken: 'tok',
      realmId: 'realm',
    });

    const res = await POST(makeRequest({ dataType: 'payments', format: 'csv' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.downloadUrl).toMatch(/\.csv/);
  });
});
