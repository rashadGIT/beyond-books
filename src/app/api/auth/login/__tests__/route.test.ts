// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../../../__mocks__/prisma';

jest.mock('@/lib/cognito', () => ({
  signIn: jest.fn(),
}));

import { signIn } from '@/lib/cognito';

const VALID_ID_TOKEN = [
  Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: 'user-123', name: 'Test User' })).toString('base64url'),
  'sig',
].join('.');

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  it('returns 400 when body fails Zod validation', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'pw' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when password is empty', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', password: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 200 and sets cookies on successful login', async () => {
    (signIn as jest.Mock).mockResolvedValueOnce({
      AuthenticationResult: {
        AccessToken: 'access-tok',
        IdToken: VALID_ID_TOKEN,
        RefreshToken: 'refresh-tok',
        ExpiresIn: 3600,
      },
    });
    (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({ id: 'user-123', email: 'a@b.com' });

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'password123' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.userId).toBe('user-123');
  });

  it('returns 401 when AuthenticationResult is missing tokens', async () => {
    (signIn as jest.Mock).mockResolvedValueOnce({ AuthenticationResult: {} });

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'pass' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 with friendly message for NotAuthorizedException', async () => {
    (signIn as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Not authorized'), { name: 'NotAuthorizedException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'wrong' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Incorrect email/);
  });

  it('returns 401 with friendly message for UserNotConfirmedException', async () => {
    (signIn as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Not confirmed'), { name: 'UserNotConfirmedException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'pass' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/verify your email/);
  });
});
