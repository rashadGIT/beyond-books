// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/cognito', () => ({
  forgotPassword: jest.fn(),
}));

import { forgotPassword } from '@/lib/cognito';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/forgot-password', () => {
  it('returns 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ email: 'not-email' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 200 on success', async () => {
    (forgotPassword as jest.Mock).mockResolvedValueOnce({});

    const res = await POST(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 200 even when UserNotFoundException is thrown (security: do not reveal email existence)', async () => {
    (forgotPassword as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Not found'), { name: 'UserNotFoundException' })
    );

    const res = await POST(makeRequest({ email: 'nobody@b.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    (forgotPassword as jest.Mock).mockRejectedValueOnce(new Error('Unexpected'));

    const res = await POST(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Failed to send/);
  });
});
