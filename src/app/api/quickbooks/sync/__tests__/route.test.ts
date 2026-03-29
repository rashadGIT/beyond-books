// @jest-environment node
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

jest.mock('@/lib/qbSyncService', () => ({
  runQbSyncForUser: jest.fn().mockResolvedValue({ synced: 10 }),
}));

describe('POST /api/quickbooks/sync', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/quickbooks/sync', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with sync result on success', async () => {
    const req = new NextRequest('http://localhost/api/quickbooks/sync', {
      method: 'POST',
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.synced).toBe(10);
  });

  it('returns 500 when sync service throws', async () => {
    const { runQbSyncForUser } = require('@/lib/qbSyncService');
    runQbSyncForUser.mockRejectedValueOnce(new Error('Sync failed'));

    const req = new NextRequest('http://localhost/api/quickbooks/sync', {
      method: 'POST',
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('GET /api/quickbooks/sync', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/quickbooks/sync');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns connected=false when no connection exists', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/quickbooks/sync', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).connected).toBe(false);
  });

  it('returns connection info when QB is connected', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      companyName: 'ACME Corp',
      lastSyncAt: new Date('2024-01-01'),
      realmId: 'realm-123',
      isActive: true,
    });

    const req = new NextRequest('http://localhost/api/quickbooks/sync', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.companyName).toBe('ACME Corp');
  });
});
