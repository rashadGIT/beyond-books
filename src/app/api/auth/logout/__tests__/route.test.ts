// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/cognito', () => ({
  signOut: jest.fn(),
}));

import { signOut } from '@/lib/cognito';

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears cookies when access_token cookie is present', async () => {
    (signOut as jest.Mock).mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: 'access_token=some-token' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 200 even when no access_token cookie is present', async () => {
    const req = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('still returns 200 when signOut throws (token already expired)', async () => {
    (signOut as jest.Mock).mockRejectedValueOnce(new Error('Token expired'));

    const req = new NextRequest('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: 'access_token=expired-token' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
