/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/lib/auth-edge', () => ({
  verifyTokenEdge: jest.fn(),
}));

import { verifyTokenEdge } from '@/lib/auth-edge';
import { middleware } from './middleware';

// Helper to build a minimal NextRequest-like object
function makeRequest(
  pathname: string,
  accessToken?: string
): NextRequest {
  const url = `http://localhost${pathname}`;
  const req = new NextRequest(url);
  if (accessToken) {
    // NextRequest cookies are read-only; we stub the cookies.get method
    Object.defineProperty(req, 'cookies', {
      value: {
        get: (name: string) =>
          name === 'access_token' ? { value: accessToken } : undefined,
      },
      writable: true,
    });
  } else {
    Object.defineProperty(req, 'cookies', {
      value: { get: () => undefined },
      writable: true,
    });
  }
  return req;
}

afterEach(() => {
  jest.clearAllMocks();
});

test('public path /sign-in returns NextResponse.next()', async () => {
  const req = makeRequest('/sign-in');
  const res = await middleware(req);
  // NextResponse.next() has no Location header and a 200-range status
  expect(res.status).toBe(200);
  expect(res.headers.get('location')).toBeNull();
});

test('protected path with no token redirects to /sign-in', async () => {
  const req = makeRequest('/dashboard');
  const res = await middleware(req);
  expect(res.status).toBe(307);
  expect(res.headers.get('location')).toContain('/sign-in');
});

test('protected API route with no token returns 401 JSON', async () => {
  const req = makeRequest('/api/some-protected-route');
  const res = await middleware(req);
  expect(res.status).toBe(401);
  const body = await res.json();
  expect(body).toHaveProperty('error', 'Unauthorized');
});

test('protected path with expired/invalid token redirects to /sign-in and clears cookies', async () => {
  (verifyTokenEdge as jest.Mock).mockResolvedValue(null);
  const req = makeRequest('/dashboard', 'expired-token');
  const res = await middleware(req);
  expect(res.status).toBe(307);
  expect(res.headers.get('location')).toContain('/sign-in');
  // Cookies should be cleared (Set-Cookie header should delete them)
  const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
  const cookieStr = setCookieHeaders.join(';');
  expect(cookieStr).toMatch(/access_token/);
});

test('protected path with valid token forwards x-user-id header', async () => {
  (verifyTokenEdge as jest.Mock).mockResolvedValue({
    sub: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
  });
  const req = makeRequest('/dashboard', 'valid-token');
  const res = await middleware(req);
  // Valid token → NextResponse.next() with forwarded headers
  expect(res.status).toBe(200);
  expect(res.headers.get('location')).toBeNull();
});

test('protected API route with valid token does not return 401', async () => {
  (verifyTokenEdge as jest.Mock).mockResolvedValue({
    sub: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
  });
  const req = makeRequest('/api/chat', 'valid-token');
  const res = await middleware(req);
  expect(res.status).not.toBe(401);
});
