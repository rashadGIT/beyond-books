// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';

jest.mock('@/lib/pdfService', () => ({
  PDFService: {
    getPresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/report.pdf'),
  },
}));

describe('GET /api/reports/pdf', () => {
  it('returns 400 when key param is missing', async () => {
    const req = new NextRequest('http://localhost/api/reports/pdf');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Missing key/);
  });

  it('redirects to presigned URL when key is provided', async () => {
    const req = new NextRequest('http://localhost/api/reports/pdf?key=reports%2Ftest.pdf');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://s3.example.com/report.pdf');
  });

  it('returns 404 when getPresignedUrl throws', async () => {
    const { PDFService } = require('@/lib/pdfService');
    PDFService.getPresignedUrl.mockRejectedValueOnce(new Error('Not found'));

    const req = new NextRequest('http://localhost/api/reports/pdf?key=missing.pdf');
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('File not found');
  });
});
