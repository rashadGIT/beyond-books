// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../../../__mocks__/prisma';

const BASE_URL = 'http://localhost:3000';

beforeEach(() => {
  process.env.NEXT_PUBLIC_URL = BASE_URL;
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
});

function makeState(userId: string) {
  return Buffer.from(JSON.stringify({ userId })).toString('base64url');
}

describe('GET /api/auth/email/gmail/callback', () => {
  it('redirects with gmail_denied when error param is present', async () => {
    const req = new NextRequest(`http://localhost/api/auth/email/gmail/callback?error=access_denied`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gmail_denied');
  });

  it('redirects with gmail_denied when code is missing', async () => {
    const req = new NextRequest(`http://localhost/api/auth/email/gmail/callback?state=${makeState('u1')}`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gmail_denied');
  });

  it('redirects with gmail_denied when state is missing', async () => {
    const req = new NextRequest(`http://localhost/api/auth/email/gmail/callback?code=auth-code`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('gmail_denied');
  });

  it('redirects with invalid_state when state is malformed', async () => {
    const req = new NextRequest(`http://localhost/api/auth/email/gmail/callback?code=auth-code&state=not-valid-base64-json`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('invalid_state');
  });

  it('redirects with email_connected=gmail on success', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          access_token: 'gmail-access',
          refresh_token: 'gmail-refresh',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ email: 'user@gmail.com', name: 'Gmail User' }),
      });
    (prisma.emailProvider.upsert as jest.Mock).mockResolvedValueOnce({});

    const state = makeState('user-123');
    const req = new NextRequest(`http://localhost/api/auth/email/gmail/callback?code=auth-code&state=${state}`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('email_connected=gmail');
  });

  it('redirects with token_exchange_failed when token fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({ error: 'invalid_grant' }),
    });

    const state = makeState('user-123');
    const req = new NextRequest(`http://localhost/api/auth/email/gmail/callback?code=bad-code&state=${state}`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('token_exchange_failed');
  });
});
