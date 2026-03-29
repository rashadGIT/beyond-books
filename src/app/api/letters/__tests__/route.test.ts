// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '../../../../__mocks__/prisma';

jest.mock('@/lib/pdfService', () => ({
  PDFService: {
    createDonationLetter: jest.fn().mockResolvedValue({ id: 'letter-1', pdfPath: 'letters/l1.pdf' }),
    getPresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/l1.pdf'),
  },
}));

jest.mock('@/lib/chatFileService', () => ({
  ChatFileService: {
    groupTransactionsByDonor: jest.fn().mockResolvedValue([
      { name: 'Alice Smith', email: 'alice@example.com', total: 500, transactions: [{ id: 'tx-1' }] },
    ]),
  },
}));

jest.mock('@/lib/emailService', () => ({
  sendDonationLetter: jest.fn().mockResolvedValue({ success: true }),
}));

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

describe('GET /api/letters', () => {
  it('returns all letters on success', async () => {
    (prisma.donationLetter.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'letter-1', donorName: 'Alice', transactions: [] },
    ]);

    const req = new NextRequest('http://localhost/api/letters');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe('letter-1');
  });

  it('returns presigned URL when download param is provided', async () => {
    (prisma.donationLetter.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'letter-1',
      pdfPath: 'letters/l1.pdf',
    });

    const req = new NextRequest('http://localhost/api/letters?download=letter-1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe('https://s3.example.com/l1.pdf');
  });

  it('returns 404 when download letter is not found', async () => {
    (prisma.donationLetter.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/letters?download=missing-id');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.donationLetter.findMany as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/letters');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

describe('POST /api/letters', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_single', donorName: 'Alice' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (missing action)', async () => {
    const req = new NextRequest('http://localhost/api/letters', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when action is invalid', async () => {
    const req = new NextRequest('http://localhost/api/letters', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ action: 'bad_action' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid action');
  });

  it('returns 404 when donor is not found for send_single', async () => {
    (prisma.orgBranding.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/letters', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ action: 'send_single', donorName: 'Unknown Person' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  it('returns 200 with success on send_single for existing donor', async () => {
    (prisma.orgBranding.findUnique as jest.Mock).mockResolvedValueOnce({ orgName: 'Test Org' });
    (prisma.emailLog.create as jest.Mock).mockResolvedValueOnce({});
    (prisma.donationLetter.update as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/letters', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ action: 'send_single', donorName: 'Alice Smith' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.donorName).toBe('Alice Smith');
  });

  it('returns 200 on send_bulk', async () => {
    (prisma.orgBranding.findUnique as jest.Mock).mockResolvedValueOnce({ orgName: 'Test Org' });
    (prisma.emailLog.create as jest.Mock).mockResolvedValue({});
    (prisma.donationLetter.update as jest.Mock).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/letters', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ action: 'send_bulk' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('sent');
    expect(body).toHaveProperty('failed');
  });
});
