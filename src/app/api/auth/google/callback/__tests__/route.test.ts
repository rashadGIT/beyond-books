// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../../../__mocks__/prisma';

const APP_URL = 'http://localhost:3000';

beforeEach(() => {
  process.env.NEXT_PUBLIC_URL = APP_URL;
  process.env.COGNITO_DOMAIN = 'https://auth.example.com';
  process.env.COGNITO_CLIENT_ID = 'test-client-id';
});

const VALID_ID_TOKEN = [
  Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: 'google-user-123', email: 'g@example.com', name: 'Google User' })).toString('base64url'),
  'sig',
].join('.');

describe('GET /api/auth/google/callback', () => {
  it('redirects to sign-in with error when error param is present', async () => {
    const req = new NextRequest(`http://localhost/api/auth/google/callback?error=access_denied`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/sign-in?error=');
  });

  it('redirects to sign-in with missing_code when code is absent', async () => {
    const req = new NextRequest(`http://localhost/api/auth/google/callback?state=abc`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('missing_code');
  });

  it('redirects to home on successful token exchange', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        access_token: 'access',
        id_token: VALID_ID_TOKEN,
        refresh_token: 'refresh',
        expires_in: 3600,
      }),
      text: jest.fn(),
    });
    (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({ id: 'google-user-123' });

    const req = new NextRequest(`http://localhost/api/auth/google/callback?code=auth-code&state=optional`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${APP_URL}/`);
  });

  it('redirects to sign-in with token_exchange_failed when fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValue('Bad request'),
      json: jest.fn(),
    });

    const req = new NextRequest(`http://localhost/api/auth/google/callback?code=bad-code`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('token_exchange_failed');
  });

  it('redirects to sign-in with auth_failed on unexpected error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const req = new NextRequest(`http://localhost/api/auth/google/callback?code=some-code`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('auth_failed');
  });
});
