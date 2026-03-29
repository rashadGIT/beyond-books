// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../__mocks__/prisma';

jest.mock('@/lib/parser', () => ({
  processCSV: jest.fn().mockReturnValue({
    source: 'CSV',
    transactions: [
      { id: 'tx-1', date: new Date(), source: 'CSV', donorName: 'Alice', donorEmail: 'a@b.com', grossAmount: 100, fee: 0, netAmount: 100, description: 'Donation', originalData: {} },
    ],
  }),
  processExcel: jest.fn().mockResolvedValue({
    source: 'EXCEL',
    transactions: [],
  }),
}));

jest.mock('@/lib/awsClients', () => ({
  s3Client: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

function makeCsvFormData(name = 'transactions.csv', size = 100): FormData {
  const fd = new FormData();
  const file = new File(['date,amount\n2024-01-01,100'], name, { type: 'text/csv' });
  Object.defineProperty(file, 'size', { value: size });
  fd.append('file', file);
  return fd;
}

describe('POST /api/upload', () => {
  it('returns 400 when no file is provided', async () => {
    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: new FormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No file/);
  });

  it('returns 400 when file type is invalid', async () => {
    const fd = new FormData();
    fd.append('file', new File(['data'], 'report.txt', { type: 'text/plain' }));
    const req = new NextRequest('http://localhost/api/upload', { method: 'POST', body: fd });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid file type/);
  });

  it('returns 400 when file is too large', async () => {
    // Use a plain object with the File interface to simulate an oversized file
    const mockLargeFile = {
      name: 'big.csv',
      size: 11 * 1024 * 1024,
      type: 'text/csv',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
    };
    const mockFormData = { get: jest.fn().mockReturnValue(mockLargeFile) };
    const req = new NextRequest('http://localhost/api/upload', { method: 'POST' });
    jest.spyOn(req, 'formData').mockResolvedValueOnce(mockFormData as unknown as FormData);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/too large/);
  });

  it('returns 200 on successful CSV upload', async () => {
    (prisma.processedFile.create as jest.Mock).mockResolvedValueOnce({
      id: 'file-1',
      filename: 'transactions.csv',
      transactions: [],
    });

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: makeCsvFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.processedFile.create as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: makeCsvFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
