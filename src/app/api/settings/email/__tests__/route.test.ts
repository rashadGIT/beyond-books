// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/emailService', () => ({
  sendViaResend: jest.fn().mockResolvedValue({ success: true }),
  sendViaGmail: jest.fn().mockResolvedValue({ success: true }),
  sendViaSES: jest.fn().mockResolvedValue({ success: true }),
  refreshGmailToken: jest.fn().mockResolvedValue({ accessToken: 'new-token', tokenExpiry: new Date(Date.now() + 3600000) }),
}));

const AUTH_HEADERS = { 'x-user-id': 'test-user-id', 'Content-Type': 'application/json' };

const RESEND_PROVIDER = {
  userId: 'test-user-id',
  provider: 'resend',
  fromEmail: 'org@example.com',
  fromName: 'My Org',
  resendApiKey: 'resend-key-123',
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null,
};

describe('GET /api/settings/email', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/email');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns configured=false when no provider exists', async () => {
    (prisma.emailProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/settings/email', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).configured).toBe(false);
  });

  it('returns provider info when configured', async () => {
    (prisma.emailProvider.findUnique as jest.Mock).mockResolvedValueOnce(RESEND_PROVIDER);

    const req = new NextRequest('http://localhost/api/settings/email', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configured).toBe(true);
    expect(body.provider).toBe('resend');
    expect(body.hasApiKey).toBe(true);
  });
});

describe('POST /api/settings/email', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'resend' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 on disconnect action', async () => {
    (prisma.emailProvider.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

    const req = new NextRequest('http://localhost/api/settings/email', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ action: 'disconnect' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 400 when action=test and no provider is configured', async () => {
    (prisma.emailProvider.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/settings/email', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ action: 'test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when saving resend config with missing fields', async () => {
    const req = new NextRequest('http://localhost/api/settings/email', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'resend', fromEmail: 'org@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/required/);
  });

  it('returns 200 when saving valid resend config', async () => {
    (prisma.emailProvider.upsert as jest.Mock).mockResolvedValueOnce(RESEND_PROVIDER);

    const req = new NextRequest('http://localhost/api/settings/email', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        provider: 'resend',
        fromEmail: 'org@example.com',
        fromName: 'My Org',
        resendApiKey: 'resend-key-123',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 400 when saving SES config with missing fields', async () => {
    const req = new NextRequest('http://localhost/api/settings/email', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'ses' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 when saving valid SES config', async () => {
    (prisma.emailProvider.upsert as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/settings/email', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ provider: 'ses', fromEmail: 'org@example.com', fromName: 'My Org' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
