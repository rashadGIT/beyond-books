// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/cognito', () => ({
  signUp: jest.fn(),
}));

import { signUp } from '@/lib/cognito';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  it('returns 400 when body fails Zod validation (short password)', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'short', name: 'Alice' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'Password1!', name: 'Alice' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 200 on successful registration', async () => {
    (signUp as jest.Mock).mockResolvedValueOnce({});

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Password1!', name: 'Alice' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/verify/i);
  });

  it('returns 400 with friendly message for UsernameExistsException', async () => {
    (signUp as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('User exists'), { name: 'UsernameExistsException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Password1!', name: 'Alice' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
  });

  it('returns 400 with friendly message for InvalidPasswordException', async () => {
    (signUp as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Bad password'), { name: 'InvalidPasswordException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'Password1!', name: 'Alice' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Password must be/);
  });
});
