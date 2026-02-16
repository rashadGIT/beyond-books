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
   * Save tokens to database
   */
  async saveConnection(data: {
    realmId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn: number;
    companyName?: string;
  }) {
    const expiresAt = new Date(Date.now() + data.expiresIn * 1000);
    const refreshExpiresAt = new Date(
      Date.now() + data.refreshExpiresIn * 1000
    );

    return prisma.quickBooksConnection.upsert({
      where: { realmId: data.realmId },
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt,
        refreshExpiresAt,
        companyName: data.companyName,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
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

  /**
   * Get active connection
   */
  async getActiveConnection() {
    return prisma.quickBooksConnection.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(): Promise<string | null> {
    const connection = await this.getActiveConnection();
    if (!connection) return null;

    // Check if token is expired
    const now = new Date();
    if (connection.expiresAt > now) {
      return connection.accessToken;
    }

    // Check if refresh token is expired
    if (connection.refreshExpiresAt <= now) {
      throw new Error('Refresh token expired. Please reconnect to QuickBooks.');
    }

    // Refresh the token
    const tokens = await this.refreshAccessToken(connection.refreshToken);

    // Save new tokens
    await this.saveConnection({
      realmId: connection.realmId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      refreshExpiresIn: tokens.x_refresh_token_expires_in,
    });

    return tokens.access_token;
  }

  /**
   * Make authenticated API call to QuickBooks
   */
  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const connection = await this.getActiveConnection();
    if (!connection) {
      throw new Error('No active QuickBooks connection');
    }

    const accessToken = await this.getValidAccessToken();
    if (!accessToken) {
      throw new Error('Failed to get valid access token');
    }

    const url = `${this.baseUrl}/v3/company/${connection.realmId}/${endpoint}`;

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

  /**
   * Get company info
   */
  async getCompanyInfo() {
    const connection = await this.getActiveConnection();
    if (!connection) {
      throw new Error('No active QuickBooks connection');
    }

    return this.makeRequest<any>(
      `companyinfo/${connection.realmId}`
    );
  }

  /**
   * Test connection by making actual API call to QuickBooks
   */
  async testConnection(): Promise<boolean> {
    try {
      const connection = await this.getActiveConnection();
      if (!connection) {
        console.log('❌ No QuickBooks connection to test');
        return false;
      }

      console.log(`🔄 Making API call to QuickBooks (realmId: ${connection.realmId})...`);
      const companyInfo = await this.getCompanyInfo();

      console.log('✅ QuickBooks API call successful:', {
        companyName: companyInfo.CompanyInfo?.CompanyName,
        country: companyInfo.CompanyInfo?.Country,
      });

      return true;
    } catch (error: any) {
      console.error('❌ QuickBooks API call failed:', {
        error: error.message,
        details: error.toString(),
      });
      return false;
    }
  }

  /**
   * Query QuickBooks data
   */
  async query<T>(query: string): Promise<T> {
    const encodedQuery = encodeURIComponent(query);
    return this.makeRequest<T>(`query?query=${encodedQuery}`);
  }

  /**
   * Get sales receipts
   */
  async getSalesReceipts(startDate?: string, endDate?: string) {
    let query = 'SELECT * FROM SalesReceipt';

    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }

    query += ' MAXRESULTS 1000';

    return this.query<any>(query);
  }

  /**
   * Get invoices
   */
  async getInvoices(startDate?: string, endDate?: string) {
    let query = 'SELECT * FROM Invoice';

    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }

    query += ' MAXRESULTS 1000';

    return this.query<any>(query);
  }

  /**
   * Get payments
   */
  async getPayments(startDate?: string, endDate?: string) {
    let query = 'SELECT * FROM Payment';

    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }

    query += ' MAXRESULTS 1000';

    return this.query<any>(query);
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
