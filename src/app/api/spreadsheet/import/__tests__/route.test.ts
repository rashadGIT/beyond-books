// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/awsClients', () => ({
  s3Client: {
    send: jest.fn().mockResolvedValue({
      Body: (async function* () { yield Buffer.from('Name,DisplayName\nExample,Example'); })(),
    }),
  },
}));

jest.mock('@/lib/excelService', () => ({
  ExcelService: {
    parseFile: jest.fn().mockReturnValue([{ DisplayName: 'ACME Corp' }]),
  },
}));

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    createCustomerForConnection: jest.fn().mockResolvedValue({ id: 'qb-cust-1' }),
    createVendorForConnection: jest.fn().mockResolvedValue({ id: 'qb-vendor-1' }),
    createInvoiceForConnection: jest.fn().mockResolvedValue({ id: 'qb-inv-1' }),
    createItemForConnection: jest.fn().mockResolvedValue({ id: 'qb-item-1' }),
    createAccountForConnection: jest.fn().mockResolvedValue({ id: 'qb-acct-1' }),
  }),
}));

function makeRequest(headers: Record<string, string>, body: unknown) {
  return new NextRequest('http://localhost/api/spreadsheet/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/spreadsheet/import', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const res = await POST(makeRequest({}, { fileId: 'f1', entityType: 'customers' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (missing entityType)', async () => {
    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, { fileId: 'f1' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when entityType is invalid', async () => {
    (prisma.processedFile.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'f1',
      filename: 'data.csv',
      filePath: 'qb-imports/user-1/data.csv',
    });
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({ userId: 'user-1', isActive: true });

    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, { fileId: 'f1', entityType: 'bad_type' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid entityType/);
  });

  it('returns 400 when no file is found', async () => {
    (prisma.processedFile.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, { fileId: 'missing', entityType: 'customers' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No import file/);
  });

  it('returns 400 when QuickBooks is not connected', async () => {
    (prisma.processedFile.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'f1',
      filename: 'data.csv',
      filePath: 's3-key',
    });
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, { fileId: 'f1', entityType: 'customers' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/QuickBooks not connected/);
  });

  it('returns 200 with created count on success', async () => {
    (prisma.processedFile.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'f1',
      filename: 'data.csv',
      filePath: 'qb-imports/user-1/data.csv',
    });
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'user-1',
      isActive: true,
      accessToken: 'tok',
      realmId: 'realm',
    });

    const res = await POST(makeRequest({ 'x-user-id': 'user-1' }, { fileId: 'f1', entityType: 'customers' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('created');
    expect(body).toHaveProperty('total');
  });
});
