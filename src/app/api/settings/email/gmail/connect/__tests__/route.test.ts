// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';

const BASE_URL = 'http://localhost:3000';

beforeEach(() => {
  process.env.NEXT_PUBLIC_URL = BASE_URL;
});

describe('GET /api/settings/email/gmail/connect', () => {
  it('redirects to sign-in when x-user-id is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    const req = new NextRequest('http://localhost/api/settings/email/gmail/connect');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/sign-in');
  });

  it('returns 500 when GOOGLE_CLIENT_ID is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const req = new NextRequest('http://localhost/api/settings/email/gmail/connect', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/not configured/i);
  });

  it('redirects to Google OAuth URL when user is authenticated and clientId is set', async () => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    const req = new NextRequest('http://localhost/api/settings/email/gmail/connect', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('accounts.google.com');
  });
});
