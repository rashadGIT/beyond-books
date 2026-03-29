// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/cognito', () => ({
  confirmForgotPassword: jest.fn(),
}));

import { confirmForgotPassword } from '@/lib/cognito';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when body fails Zod validation (short password)', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', code: '123456', newPassword: 'short' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ code: '123456', newPassword: 'Password1!' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 200 on successful reset', async () => {
    (confirmForgotPassword as jest.Mock).mockResolvedValueOnce({});

    const res = await POST(makeRequest({ email: 'a@b.com', code: '123456', newPassword: 'NewPassword1!' }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 400 with friendly message for CodeMismatchException', async () => {
    (confirmForgotPassword as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Mismatch'), { name: 'CodeMismatchException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', code: '000', newPassword: 'NewPassword1!' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid reset code/);
  });

  it('returns 400 with friendly message for ExpiredCodeException', async () => {
    (confirmForgotPassword as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Expired'), { name: 'ExpiredCodeException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', code: '000', newPassword: 'NewPassword1!' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/expired/i);
  });

  it('returns 400 with friendly message for InvalidPasswordException', async () => {
    (confirmForgotPassword as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Bad pw'), { name: 'InvalidPasswordException' })
    );

    const res = await POST(makeRequest({ email: 'a@b.com', code: '000', newPassword: 'NewPassword1!' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Password must be/);
  });

  it('returns 500 on unexpected error', async () => {
    (confirmForgotPassword as jest.Mock).mockRejectedValueOnce(new Error('Unknown'));

    const res = await POST(makeRequest({ email: 'a@b.com', code: '000', newPassword: 'NewPassword1!' }));
    expect(res.status).toBe(500);
  });
});
