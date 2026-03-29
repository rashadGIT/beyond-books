// @jest-environment node
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

const AUTH_HEADERS = {
  'x-user-id': 'test-user-id',
  'Content-Type': 'application/json',
};

describe('GET /api/settings/branding', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/branding');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns saved branding when it exists', async () => {
    (prisma.orgBranding.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      orgName: 'My Org',
      tagLine: 'Together we grow',
      taxId: '12-3456789',
    });

    const req = new NextRequest('http://localhost/api/settings/branding', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).orgName).toBe('My Org');
  });

  it('returns default branding when no record exists', async () => {
    (prisma.orgBranding.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/settings/branding', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orgName).toBe('Your Organization');
  });
});

describe('POST /api/settings/branding', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/settings/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body fails Zod validation (invalid color format)', async () => {
    const req = new NextRequest('http://localhost/api/settings/branding', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ primaryColor: 'not-a-hex-color' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when logoUrl is not a valid URL', async () => {
    const req = new NextRequest('http://localhost/api/settings/branding', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ logoUrl: 'not-a-url' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with saved branding on success', async () => {
    (prisma.orgBranding.upsert as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      orgName: 'New Org',
      primaryColor: '#ff0000',
    });

    const req = new NextRequest('http://localhost/api/settings/branding', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ orgName: 'New Org', primaryColor: '#ff0000' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).orgName).toBe('New Org');
  });
});
