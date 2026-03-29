// @jest-environment node
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

describe('POST /api/quickbooks/disconnect', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/quickbooks/disconnect', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 and deletes connection on success', async () => {
    (prisma.quickBooksConnection.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });

    const req = new NextRequest('http://localhost/api/quickbooks/disconnect', {
      method: 'POST',
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(prisma.quickBooksConnection.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'test-user-id' },
    });
  });
});
