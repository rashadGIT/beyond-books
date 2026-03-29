// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/cognito', () => ({
  resendConfirmationCode: jest.fn(),
}));

import { resendConfirmationCode } from '@/lib/cognito';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/resend-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/resend-code', () => {
  it('returns 400 when email is invalid', async () => {
    const res = await POST(makeRequest({ email: 'bad-email' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 200 on successful resend', async () => {
    (resendConfirmationCode as jest.Mock).mockResolvedValueOnce({});

    const res = await POST(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 500 when resendConfirmationCode throws', async () => {
    (resendConfirmationCode as jest.Mock).mockRejectedValueOnce(new Error('Cognito down'));

    const res = await POST(makeRequest({ email: 'a@b.com' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Failed to resend/);
  });
});
