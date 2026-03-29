// @jest-environment node
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '../../../../../__mocks__/prisma';

const APP_URL = 'http://localhost:3000';

beforeEach(() => {
  process.env.NEXT_PUBLIC_URL = APP_URL;
});

jest.mock('@/lib/quickbooksService', () => ({
  getQuickBooksService: jest.fn().mockReturnValue({
    getAuthorizationUrl: jest.fn().mockReturnValue('https://auth.intuit.com/'),
    getAccessToken: jest.fn().mockResolvedValue({
      access_token: 'qb-access',
      refresh_token: 'qb-refresh',
      expires_in: 3600,
      x_refresh_token_expires_in: 86400,
    }),
    saveConnectionForUser: jest.fn().mockResolvedValue({}),
    getCompanyInfoForConnection: jest.fn().mockResolvedValue({
      CompanyInfo: { CompanyName: 'ACME Corp' },
    }),
  }),
}));

function makeState(userId: string) {
  return Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
}

describe('GET /api/quickbooks/callback', () => {
  it('redirects with qb_error when error param is present', async () => {
    const req = new NextRequest(`http://localhost/api/quickbooks/callback?error=access_denied`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('qb_error=');
  });

  it('redirects with missing_parameters when code or realmId is missing', async () => {
    const req = new NextRequest(`http://localhost/api/quickbooks/callback?state=${makeState('u1')}`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('missing_parameters');
  });

  it('redirects with invalid_state when state is malformed', async () => {
    const req = new NextRequest(`http://localhost/api/quickbooks/callback?code=c1&realmId=r1&state=bad-state`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('invalid_state');
  });

  it('redirects with qb_connected=true on success', async () => {
    (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.quickBooksConnection.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'user-1',
      realmId: 'r1',
      isActive: true,
    });
    (prisma.quickBooksConnection.update as jest.Mock).mockResolvedValueOnce({});

    const state = makeState('user-1');
    const req = new NextRequest(`http://localhost/api/quickbooks/callback?code=auth-code&realmId=realm-1&state=${state}`);
    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('qb_connected=true');
  });
});
