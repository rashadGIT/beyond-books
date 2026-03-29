// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/emailService', () => ({
  sendViaResend: jest.fn().mockResolvedValue({ success: true }),
  sendViaGmail: jest.fn().mockResolvedValue({ success: true }),
  sendViaSES: jest.fn().mockResolvedValue({ success: true }),
  refreshGmailToken: jest.fn().mockResolvedValue(null),
}));

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

const SINGLE_PAYLOAD = {
  donorName: 'Alice Smith',
  donorEmail: 'alice@example.com',
  totalAmount: 500,
  orgName: 'Test Org',
};

describe('POST /api/letters/send', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/letters/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(SINGLE_PAYLOAD),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (invalid email)', async () => {
    const req = new NextRequest('http://localhost/api/letters/send', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        action: 'single',
        donors: [{ donorName: 'Alice', donorEmail: 'not-email', totalAmount: 100 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when email provider is not configured', async () => {
    (prisma.emailProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/letters/send', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify(SINGLE_PAYLOAD),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not configured/i);
  });

  it('returns 400 when donorEmail is missing for single send', async () => {
    (prisma.emailProvider.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      provider: 'resend',
      fromEmail: 'org@example.com',
      fromName: 'Test Org',
      resendApiKey: 'key-123',
    });

    const req = new NextRequest('http://localhost/api/letters/send', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ donorName: 'Alice', totalAmount: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/donorEmail is required/);
  });

  it('returns 200 on successful single send via Resend', async () => {
    (prisma.emailProvider.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      provider: 'resend',
      fromEmail: 'org@example.com',
      fromName: 'Test Org',
      resendApiKey: 'key-123',
    });
    (prisma.emailLog.create as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/letters/send', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify(SINGLE_PAYLOAD),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 200 with bulk stats on action=bulk', async () => {
    (prisma.emailProvider.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      provider: 'ses',
      fromEmail: 'org@example.com',
      fromName: 'Test Org',
      resendApiKey: null,
    });
    (prisma.emailLog.create as jest.Mock).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/letters/send', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        action: 'bulk',
        donors: [
          { donorName: 'Alice', donorEmail: 'alice@example.com', totalAmount: 100, orgName: 'Test Org' },
          { donorName: 'Bob', donorEmail: 'bob@example.com', totalAmount: 200, orgName: 'Test Org' },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('sent');
    expect(body).toHaveProperty('failed');
  });
});
