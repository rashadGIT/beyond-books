// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../../__mocks__/prisma';

describe('GET /api/integrations/quickbooks/status', () => {
  it('returns 401 when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/integrations/quickbooks/status');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect((await res.json()).connected).toBe(false);
  });

  it('returns connected=false when no active connection exists', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/integrations/quickbooks/status', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).connected).toBe(false);
  });

  it('returns connected=false when connection is inactive', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: false,
      companyName: 'ACME',
      lastSyncAt: new Date(),
      realmId: 'r1',
    });

    const req = new NextRequest('http://localhost/api/integrations/quickbooks/status', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect((await res.json()).connected).toBe(false);
  });

  it('returns connection details when QB is active', async () => {
    const syncDate = new Date('2024-06-01T12:00:00Z');
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'test-user-id',
      isActive: true,
      companyName: 'ACME Corp',
      lastSyncAt: syncDate,
      realmId: 'realm-123',
    });

    const req = new NextRequest('http://localhost/api/integrations/quickbooks/status', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(body.companyName).toBe('ACME Corp');
    expect(body.realmId).toBe('realm-123');
  });

  it('returns 500 when Prisma throws', async () => {
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/integrations/quickbooks/status', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
