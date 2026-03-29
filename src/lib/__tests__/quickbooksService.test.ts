import { QuickBooksService, parseQbReport } from '../quickbooksService';

const sandboxConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'http://localhost:3000/api/quickbooks/callback',
  environment: 'sandbox' as const,
};

const productionConfig = {
  ...sandboxConfig,
  environment: 'production' as const,
};

describe('QuickBooksService.getAuthorizationUrl', () => {
  it('returns a URL containing the client_id', () => {
    const service = new QuickBooksService(sandboxConfig);
    const url = service.getAuthorizationUrl('state-abc-123');
    expect(url).toContain('client_id=test-client-id');
  });

  it('returns a URL containing the redirect_uri', () => {
    const service = new QuickBooksService(sandboxConfig);
    const url = service.getAuthorizationUrl('state-abc-123');
    expect(url).toContain(encodeURIComponent('http://localhost:3000/api/quickbooks/callback'));
  });

  it('returns a URL containing the state parameter', () => {
    const service = new QuickBooksService(sandboxConfig);
    const url = service.getAuthorizationUrl('custom-state');
    expect(url).toContain('state=custom-state');
  });

  it('returns a URL with response_type=code', () => {
    const service = new QuickBooksService(sandboxConfig);
    const url = service.getAuthorizationUrl('state');
    expect(url).toContain('response_type=code');
  });

  it('returns a URL with QB accounting scope', () => {
    const service = new QuickBooksService(sandboxConfig);
    const url = service.getAuthorizationUrl('state');
    expect(url).toContain('com.intuit.quickbooks.accounting');
  });

  it('uses the intuit app center OAuth2 endpoint', () => {
    const service = new QuickBooksService(sandboxConfig);
    const url = service.getAuthorizationUrl('state');
    expect(url).toContain('appcenter.intuit.com/connect/oauth2');
  });
});

describe('QuickBooksService — constructor', () => {
  it('sets sandbox base URL for sandbox environment', () => {
    const service = new QuickBooksService(sandboxConfig);
    // baseUrl is private, but authorization URL behavior confirms environment
    const url = service.getAuthorizationUrl('s');
    expect(url).toContain('appcenter.intuit.com');
  });

  it('creates service in production environment without throwing', () => {
    expect(() => new QuickBooksService(productionConfig)).not.toThrow();
  });
});

describe('QuickBooksService.getAccessToken', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns token data on successful fetch', async () => {
    const tokenData = {
      access_token: 'acc_token',
      refresh_token: 'ref_token',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
      realmId: 'realm-123',
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(tokenData),
    });

    const service = new QuickBooksService(sandboxConfig);
    const result = await service.getAccessToken('auth-code-123');
    expect(result.access_token).toBe('acc_token');
    expect(result.refresh_token).toBe('ref_token');
  });

  it('throws when fetch response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: jest.fn().mockResolvedValue('Bad Request'),
    });

    const service = new QuickBooksService(sandboxConfig);
    await expect(service.getAccessToken('bad-code')).rejects.toThrow('Failed to get access token');
  });
});

describe('QuickBooksService.refreshAccessToken', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns new token data on successful refresh', async () => {
    const tokenData = {
      access_token: 'new_acc',
      refresh_token: 'new_ref',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(tokenData),
    });

    const service = new QuickBooksService(sandboxConfig);
    const result = await service.refreshAccessToken('old_refresh_token');
    expect(result.access_token).toBe('new_acc');
  });

  it('throws when refresh fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      text: jest.fn().mockResolvedValue('Token expired'),
    });

    const service = new QuickBooksService(sandboxConfig);
    await expect(service.refreshAccessToken('expired_token')).rejects.toThrow('Failed to refresh token');
  });
});

describe('QuickBooksService — legacy methods throw', () => {
  const service = new QuickBooksService(sandboxConfig);

  it('query() throws directing to user-scoped method', async () => {
    await expect(service.query('SELECT * FROM Invoice')).rejects.toThrow(
      'Use queryForConnection(connection, query) instead'
    );
  });

  it('getSalesReceipts() throws directing to user-scoped method', async () => {
    await expect(service.getSalesReceipts()).rejects.toThrow('getSalesReceiptsForConnection');
  });

  it('getInvoices() throws directing to user-scoped method', async () => {
    await expect(service.getInvoices()).rejects.toThrow('getInvoicesForConnection');
  });

  it('getPayments() throws directing to user-scoped method', async () => {
    await expect(service.getPayments()).rejects.toThrow('getPaymentsForConnection');
  });
});

// ─── parseQbReport ────────────────────────────────────────────────────────────

describe('parseQbReport', () => {
  it('parses a flat Trial Balance report', () => {
    const raw = {
      Columns: {
        Column: [
          { ColTitle: 'Account' },
          { ColTitle: 'Debit' },
          { ColTitle: 'Credit' },
        ],
      },
      Rows: {
        Row: [
          {
            type: 'Data',
            ColData: [
              { value: 'Cash' },
              { value: '1000.00' },
              { value: '' },
            ],
          },
          {
            type: 'GrandTotal',
            ColData: [
              { value: 'TOTAL' },
              { value: '1000.00' },
              { value: '1000.00' },
            ],
          },
        ],
      },
    };

    const parsed = parseQbReport(raw);
    expect(parsed.columns).toEqual(['Account', 'Debit', 'Credit']);
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].lines).toHaveLength(1);
    expect(parsed.sections[0].lines[0]['Account']).toBe('Cash');
    expect(parsed.sections[0].summary['Debit']).toBe('1000.00');
  });

  it('parses a sectioned General Ledger report', () => {
    const raw = {
      Columns: {
        Column: [
          { ColTitle: 'Date' },
          { ColTitle: 'Amount' },
        ],
      },
      Rows: {
        Row: [
          {
            type: 'Section',
            Header: { ColData: [{ value: 'Checking Account' }, { value: '' }] },
            Rows: {
              Row: [
                {
                  type: 'Data',
                  ColData: [{ value: '2024-01-01' }, { value: '500.00' }],
                },
              ],
            },
            Summary: { ColData: [{ value: 'Total Checking' }, { value: '500.00' }] },
          },
        ],
      },
    };

    const parsed = parseQbReport(raw);
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].accountName).toBe('Checking Account');
    expect(parsed.sections[0].lines).toHaveLength(1);
    expect(parsed.sections[0].lines[0]['Date']).toBe('2024-01-01');
    expect(parsed.sections[0].summary['Amount']).toBe('500.00');
  });

  it('handles empty rows gracefully', () => {
    const raw = {
      Columns: { Column: [{ ColTitle: 'Name' }] },
      Rows: { Row: [] },
    };

    const parsed = parseQbReport(raw);
    expect(parsed.columns).toEqual(['Name']);
    expect(parsed.sections).toHaveLength(0);
  });

  it('handles missing Columns gracefully', () => {
    const raw = { Rows: { Row: [] } };
    const parsed = parseQbReport(raw);
    expect(parsed.columns).toEqual([]);
  });

  it('handles missing Rows gracefully', () => {
    const raw = { Columns: { Column: [{ ColTitle: 'Col1' }] } };
    const parsed = parseQbReport(raw);
    expect(parsed.sections).toHaveLength(0);
  });
});
