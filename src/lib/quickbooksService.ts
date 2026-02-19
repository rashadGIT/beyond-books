import { prisma } from './prisma';

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
}

export class QuickBooksService {
  private config: QuickBooksConfig;
  private baseUrl: string;
  private discoveryUrl: string;

  constructor(config: QuickBooksConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'sandbox'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';
    this.discoveryUrl =
      config.environment === 'sandbox'
        ? 'https://developer.intuit.com/.well-known/openid_sandbox_configuration/'
        : 'https://developer.intuit.com/.well-known/openid_configuration/';
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(state: string): string {
    const authUrl =
      this.config.environment === 'sandbox'
        ? 'https://appcenter.intuit.com/connect/oauth2'
        : 'https://appcenter.intuit.com/connect/oauth2';

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      state: state,
    });

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    realmId: string;
  }> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get access token: ${error}`);
    }

    return response.json();
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  }> {
    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    return response.json();
  }


  /**
   * Query QuickBooks data (legacy, not user-scoped - kept for internal use only)
   */
  async query<T>(query: string): Promise<T> {
    throw new Error('Use queryForConnection(connection, query) instead');
  }

  /**
   * Get sales receipts (legacy placeholder)
   */
  async getSalesReceipts(_startDate?: string, _endDate?: string) {
    throw new Error('Use getSalesReceiptsForConnection instead');
  }

  /**
   * Get invoices (legacy placeholder)
   */
  async getInvoices(_startDate?: string, _endDate?: string) {
    throw new Error('Use getInvoicesForConnection instead');
  }

  /**
   * Get payments (legacy placeholder)
   */
  async getPayments(_startDate?: string, _endDate?: string) {
    throw new Error('Use getPaymentsForConnection instead');
  }

  /**
   * Get valid access token for a specific user connection (auto-refreshes if needed)
   */
  async getValidAccessTokenForConnection(connection: {
    id: string;
    userId: string;
    realmId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    refreshExpiresAt: Date;
  }): Promise<{ accessToken: string; realmId: string }> {
    const now = new Date();

    if (connection.expiresAt > now) {
      return { accessToken: connection.accessToken, realmId: connection.realmId };
    }

    if (connection.refreshExpiresAt <= now) {
      throw new Error('QuickBooks session expired. Please reconnect in Settings.');
    }

    const tokens = await this.refreshAccessToken(connection.refreshToken);

    await prisma.quickBooksConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        refreshExpiresAt: new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000),
        updatedAt: new Date(),
      },
    });

    return { accessToken: tokens.access_token, realmId: connection.realmId };
  }

  /**
   * Make authenticated API call scoped to a specific user connection
   */
  async makeRequestForConnection<T>(
    connection: {
      id: string;
      userId: string;
      realmId: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
      refreshExpiresAt: Date;
    },
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { accessToken, realmId } = await this.getValidAccessTokenForConnection(connection);
    const url = `${this.baseUrl}/v3/company/${realmId}/${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`QuickBooks API error: ${error}`);
    }

    return response.json();
  }

  async queryForConnection<T>(connection: any, query: string): Promise<T> {
    const encoded = encodeURIComponent(query);
    return this.makeRequestForConnection<T>(connection, `query?query=${encoded}`);
  }

  async getCompanyInfoForConnection(connection: any) {
    return this.makeRequestForConnection<any>(connection, `companyinfo/${connection.realmId}`);
  }

  async getSalesReceiptsForConnection(connection: any, startDate?: string, endDate?: string) {
    let query = 'SELECT * FROM SalesReceipt';
    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }
    query += ' ORDERBY TxnDate DESC MAXRESULTS 50';
    return this.queryForConnection<any>(connection, query);
  }

  async getInvoicesForConnection(connection: any, startDate?: string, endDate?: string) {
    let query = 'SELECT * FROM Invoice';
    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }
    query += ' ORDERBY TxnDate DESC MAXRESULTS 50';
    return this.queryForConnection<any>(connection, query);
  }

  async getUnpaidInvoicesForConnection(connection: any) {
    // QB IDS does not support > or < operators, so we fetch all and filter client-side
    const data = await this.queryForConnection<any>(
      connection,
      'SELECT * FROM Invoice MAXRESULTS 200'
    );
    const invoices: any[] = data?.QueryResponse?.Invoice || [];
    const unpaid = invoices.filter(inv => parseFloat(inv.Balance || '0') > 0);
    return {
      QueryResponse: { Invoice: unpaid, maxResults: unpaid.length },
    };
  }

  async getPaymentsForConnection(connection: any, startDate?: string, endDate?: string) {
    let query = 'SELECT * FROM Payment';
    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }
    query += ' ORDERBY TxnDate DESC MAXRESULTS 50';
    return this.queryForConnection<any>(connection, query);
  }

  /**
   * Save connection scoped to a specific user
   */
  async saveConnectionForUser(userId: string, data: {
    realmId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
    companyName?: string;
  }) {
    const expiresAt = new Date(Date.now() + data.expiresIn * 1000);
    const refreshExpiresAt = new Date(Date.now() + data.refreshExpiresIn * 1000);

    return prisma.quickBooksConnection.upsert({
      where: { userId },
      update: {
        realmId: data.realmId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt,
        refreshExpiresAt,
        companyName: data.companyName,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId,
        realmId: data.realmId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt,
        refreshExpiresAt,
        companyName: data.companyName,
        isActive: true,
      },
    });
  }
}

// Singleton instance
let quickbooksService: QuickBooksService | null = null;

export function getQuickBooksService(): QuickBooksService {
  if (!quickbooksService) {
    const config: QuickBooksConfig = {
      clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_URL}/api/quickbooks/callback`,
      environment: (process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('QuickBooks credentials not configured');
    }

    quickbooksService = new QuickBooksService(config);
  }

  return quickbooksService;
}
