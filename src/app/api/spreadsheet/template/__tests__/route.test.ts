// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';

jest.mock('@/lib/awsClients', () => ({
  s3Client: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/lib/excelService', () => ({
  ExcelService: {
    getTemplateRows: jest.fn().mockReturnValue([{ Name: 'Example' }]),
    generateCSV: jest.fn().mockReturnValue('Name\nExample'),
    generateExcel: jest.fn().mockReturnValue(Buffer.from('excel-data')),
  },
}));

jest.mock('@/lib/pdfService', () => ({
  PDFService: {
    getPresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/template.xlsx'),
  },
}));

describe('GET /api/spreadsheet/template', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/spreadsheet/template?type=invoices');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when type param is missing', async () => {
    const req = new NextRequest('http://localhost/api/spreadsheet/template', {
      headers: { 'x-user-id': 'user-1' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when type is not in the valid list', async () => {
    const req = new NextRequest('http://localhost/api/spreadsheet/template?type=invalid_type', {
      headers: { 'x-user-id': 'user-1' },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid type/);
  });

  it('redirects to presigned URL on success', async () => {
    const req = new NextRequest('http://localhost/api/spreadsheet/template?type=invoices', {
      headers: { 'x-user-id': 'user-1' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://s3.example.com/template.xlsx');
  });

  it('returns CSV when format=csv is requested', async () => {
    const req = new NextRequest('http://localhost/api/spreadsheet/template?type=customers&format=csv', {
      headers: { 'x-user-id': 'user-1' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
  });
});
