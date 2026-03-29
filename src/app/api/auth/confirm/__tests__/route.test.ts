// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/cognito', () => ({
  confirmSignUp: jest.fn(),
}));

import { confirmSignUp } from '@/lib/cognito';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/confirm', () => {
  it('returns 400 when body fails Zod validation (missing code)', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ email: 'bad', code: '123456' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 200 on successful confirmation', async () => {
    (confirmSignUp as jest.Mock).mockResolvedValueOnce({});

    const res = await POST(makeRequest({ email: 'a@b.com', code: '123456' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 with friendly message for CodeMismatchException', async () => {
    (confirmSignUp as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Mismatch'), { name: 'CodeMismatchException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', code: '000000' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid verification/);
  });

  it('returns 400 with friendly message for ExpiredCodeException', async () => {
    (confirmSignUp as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Expired'), { name: 'ExpiredCodeException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', code: '000000' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/expired/i);
  });
});
