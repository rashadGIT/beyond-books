// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    getAuthorizationUrl: jest.fn().mockReturnValue('https://oauth.intuit.com/authorize?state=abc'),
  }),
}));

describe('GET /api/quickbooks/connect', () => {
  it('redirects to sign-in when x-user-id is missing', async () => {
    const req = new NextRequest('http://localhost/api/quickbooks/connect');
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/sign-in');
  });

  it('redirects to QuickBooks OAuth URL when user is authenticated', async () => {
    const req = new NextRequest('http://localhost/api/quickbooks/connect', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('oauth.intuit.com');
  });

  it('returns 500 when QB service throws', async () => {
    const { getQuickBooksService } = require('@/lib/quickbooksService');
    getQuickBooksService.mockImplementationOnce(() => {
      throw new Error('Service unavailable');
    });

    const req = new NextRequest('http://localhost/api/quickbooks/connect', {
      headers: { 'x-user-id': 'test-user-id' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
