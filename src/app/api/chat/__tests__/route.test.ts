// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '../route';
import { prisma } from '../../../../__mocks__/prisma';

jest.mock('@/lib/aiProviders', () => ({
  generateAIResponse: jest.fn().mockResolvedValue({
    content: 'AI response',
    toolCalls: [],
  }),
}));

jest.mock('@/lib/qbMcpExecutor', () => ({
  createQbMcpClient: jest.fn().mockResolvedValue({
    listTools: jest.fn().mockResolvedValue({ tools: [] }),
    callTool: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: '{}' }] }),
  }),
}));

jest.mock('@/lib/jobService', () => ({
  JobService: {
    createJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
    getScheduledJobs: jest.fn().mockResolvedValue([]),
    runJob: jest.fn().mockResolvedValue({ id: 'exec-1' }),
  },
}));

jest.mock('@/lib/pdfService', () => ({
  PDFService: {
    generateReportPDF: jest.fn().mockResolvedValue({ pdfPath: 'reports/test.pdf' }),
    getPresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/test.pdf'),
    createDonationLetter: jest.fn().mockResolvedValue({ id: 'letter-1', pdfPath: null }),
  },
}));

jest.mock('@/lib/excelService', () => ({
  ExcelService: {
    mapInvoiceToRow: jest.fn((x) => x),
    mapPaymentToRow: jest.fn((x) => x),
    mapSalesReceiptToRow: jest.fn((x) => x),
    generateExcel: jest.fn().mockReturnValue(Buffer.from('xlsx')),
    generateCSV: jest.fn().mockReturnValue('col,val'),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'x-user-email': 'test@example.com',
  'Content-Type': 'application/json',
};

describe('GET /api/chat', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/chat');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with messages array on success', async () => {
    (prisma.chatMessage.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'm1', role: 'user', content: 'hello', timestamp: new Date() },
    ]);

    const req = new NextRequest('http://localhost/api/chat', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.chatMessage.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/chat', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/chat', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'user', content: 'hello' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (missing role)', async () => {
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ content: 'hello' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 200 with assistant response on happy path', async () => {
    (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.chatMessage.create as jest.Mock).mockResolvedValueOnce({ id: 'm1', role: 'user', content: 'hello' });
    (prisma.chatMessage.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (prisma.aISettings.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.chatMessage.create as jest.Mock).mockResolvedValueOnce({ id: 'm2', role: 'assistant', content: 'AI response' });

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ role: 'user', content: 'What are my finances?' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/chat', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/chat', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful delete', async () => {
    (prisma.chatMessage.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 5 });

    const req = new NextRequest('http://localhost/api/chat', {
      method: 'DELETE',
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });
});
