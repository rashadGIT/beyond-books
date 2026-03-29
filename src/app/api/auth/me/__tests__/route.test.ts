// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';

describe('GET /api/auth/me', () => {
  it('returns 401 when x-user-id header is missing', async () => {
    const req = new NextRequest('http://localhost/api/auth/me');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('returns user info when x-user-id header is present', async () => {
    const req = new NextRequest('http://localhost/api/auth/me', {
      headers: {
        'x-user-id': 'user-abc',
        'x-user-email': 'user@example.com',
        'x-user-name': 'Alice',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('user-abc');
    expect(body.email).toBe('user@example.com');
    expect(body.name).toBe('Alice');
  });
});
