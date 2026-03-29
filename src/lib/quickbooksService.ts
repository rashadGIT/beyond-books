import { prisma } from './prisma';
import {
  isMockConnection,
  MOCK_COMPANY_INFO,
  MOCK_ACCOUNTS,
  MOCK_INVOICES,
  MOCK_BILLS,
  MOCK_SALES_RECEIPTS,
  MOCK_PAYMENTS,
  MOCK_GENERAL_LEDGER,
  MOCK_TRIAL_BALANCE,
} from './mockQbResponses';

// ─── QB Report JSON transformer ──────────────────────────────────────────────
// QB Reports API returns a nested { Header, Columns, Rows } shape.
// This normalizes it into { columns, sections } for both UI and AI consumption.

export interface ReportLine { [column: string]: string }
export interface ReportSection { accountName: string; lines: ReportLine[]; summary: ReportLine }
export interface ParsedQbReport { columns: string[]; sections: ReportSection[] }

export function parseQbReport(raw: any): ParsedQbReport {
  const columns: string[] = (raw.Columns?.Column || []).map((c: any) => String(c.ColTitle ?? ''));
  const sections: ReportSection[] = [];
  const allRows: any[] = raw.Rows?.Row || [];

  // Check if this is a sectioned report (General Ledger) or flat (Trial Balance)
  const hasSections = allRows.some((r: any) => r.type === 'Section');

  if (hasSections) {
    for (const row of allRows) {
      if (row.type === 'Section') {
        const headerVals: string[] = (row.Header?.ColData || []).map((c: any) => String(c.value ?? ''));
        const accountName = headerVals[0] ?? '';
        const lines: ReportLine[] = [];

        for (const child of row.Rows?.Row || []) {
          if (child.type === 'Data') {
            const vals: string[] = (child.ColData || []).map((c: any) => String(c.value ?? ''));
            const line: ReportLine = {};
            columns.forEach((col, i) => { line[col] = vals[i] ?? ''; });
            lines.push(line);
          }
        }

        const summaryVals: string[] = (row.Summary?.ColData || []).map((c: any) => String(c.value ?? ''));
        const summary: ReportLine = {};
        columns.forEach((col, i) => { summary[col] = summaryVals[i] ?? ''; });

        sections.push({ accountName, lines, summary });
      }
    }
  } else {
    // Flat report (Trial Balance) — all Data rows become lines in one section
    const lines: ReportLine[] = [];
    const grandTotal: ReportLine = {};

    for (const row of allRows) {
      if (row.type === 'Data') {
        const vals: string[] = (row.ColData || []).map((c: any) => String(c.value ?? ''));
        const line: ReportLine = {};
        columns.forEach((col, i) => { line[col] = vals[i] ?? ''; });
        lines.push(line);
      } else if (row.type === 'GrandTotal') {
        const vals: string[] = (row.ColData || []).map((c: any) => String(c.value ?? ''));
        columns.forEach((col, i) => { grandTotal[col] = vals[i] ?? ''; });
      }
    }

    if (lines.length > 0) {
      sections.push({ accountName: '', lines, summary: grandTotal });
    }
  }

  return { columns, sections };
}

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
    if (isMockConnection(connection)) return MOCK_COMPANY_INFO;
    return this.makeRequestForConnection<any>(connection, `companyinfo/${connection.realmId}`);
  }

  async getSalesReceiptsForConnection(connection: any, startDate?: string, endDate?: string) {
    if (isMockConnection(connection)) return MOCK_SALES_RECEIPTS;
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
    if (isMockConnection(connection)) return MOCK_INVOICES;
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
    if (isMockConnection(connection)) {
      const invoices = MOCK_INVOICES.QueryResponse.Invoice.filter(inv => parseFloat(inv.Balance) > 0);
      return { QueryResponse: { Invoice: invoices, maxResults: invoices.length } };
    }
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
    if (isMockConnection(connection)) return MOCK_PAYMENTS;
    let query = 'SELECT * FROM Payment';
    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }
    query += ' ORDERBY TxnDate DESC MAXRESULTS 50';
    return this.queryForConnection<any>(connection, query);
  }

  // ─── Ledger & subledger read methods ───────────────────────────────────────

  async getAccountsForConnection(connection: any) {
    if (isMockConnection(connection)) return MOCK_ACCOUNTS;
    return this.queryForConnection<any>(
      connection,
      'SELECT * FROM Account ORDERBY Name MAXRESULTS 1000'
    );
  }

  async getGeneralLedgerForConnection(connection: any, startDate: string, endDate: string) {
    if (isMockConnection(connection)) return MOCK_GENERAL_LEDGER;
    const raw = await this.makeRequestForConnection<any>(
      connection,
      `reports/GeneralLedger?start_date=${startDate}&end_date=${endDate}&minorversion=65`
    );
    return parseQbReport(raw);
  }

  async getTrialBalanceForConnection(connection: any, startDate: string, endDate: string) {
    if (isMockConnection(connection)) return MOCK_TRIAL_BALANCE;
    // Try the QB Reports API first; fall back to a synthetic trial balance from
    // the Chart of Accounts (CurrentBalance) when the report returns no rows —
    // which happens in most QB Sandbox environments.
    try {
      const raw = await this.makeRequestForConnection<any>(
        connection,
        `reports/TrialBalance?start_date=${startDate}&end_date=${endDate}&minorversion=65`
      );
      const parsed = parseQbReport(raw);
      const hasData = parsed.sections.some(s => s.lines.length > 0);
      if (hasData) return parsed;
    } catch { /* fall through to synthetic */ }

    // Synthetic trial balance from Chart of Accounts
    const accountsRes = await this.queryForConnection<any>(
      connection,
      'SELECT * FROM Account MAXRESULTS 1000'
    );
    const accounts: any[] = accountsRes?.QueryResponse?.Account ?? [];

    // Debit-normal account types (positive balance → Debit column)
    const debitNormal = new Set(['Bank', 'Other Current Asset', 'Fixed Asset', 'Other Asset', 'Accounts Receivable', 'Cost of Goods Sold', 'Expense', 'Other Expense']);

    const lines: ReportLine[] = accounts
      .filter(a => a.Active && parseFloat(a.CurrentBalance ?? '0') !== 0)
      .map(a => {
        const bal = Math.abs(parseFloat(a.CurrentBalance ?? '0')).toFixed(2);
        const isDebit = debitNormal.has(a.AccountType);
        return { Account: `${a.Name} (${a.AccountType})`, Debit: isDebit ? bal : '', Credit: isDebit ? '' : bal };
      });

    return {
      columns: ['Account', 'Debit', 'Credit'],
      sections: lines.length ? [{ accountName: `Current Balances (as of today)`, lines, summary: {} }] : [],
    } as ParsedQbReport;
  }

  async getBillsForConnection(connection: any, startDate?: string, endDate?: string) {
    if (isMockConnection(connection)) return MOCK_BILLS;
    let query = 'SELECT * FROM Bill';
    if (startDate && endDate) {
      query += ` WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
    } else if (startDate) {
      query += ` WHERE TxnDate >= '${startDate}'`;
    }
    query += ' ORDERBY TxnDate DESC MAXRESULTS 50';
    return this.queryForConnection<any>(connection, query);
  }

  async getArSubledgerForConnection(connection: any) {
    const data = await this.getUnpaidInvoicesForConnection(connection);
    const invoices: any[] = data?.QueryResponse?.Invoice || [];
    const grouped = new Map<string, { totalBalance: number; invoices: any[] }>();
    for (const inv of invoices) {
      const name = inv.CustomerRef?.name ?? 'Unknown';
      if (!grouped.has(name)) grouped.set(name, { totalBalance: 0, invoices: [] });
      const g = grouped.get(name)!;
      g.totalBalance += parseFloat(inv.Balance || '0');
      g.invoices.push(inv);
    }
    return Array.from(grouped.entries())
      .map(([customerName, data]) => ({ customerName, ...data }))
      .sort((a, b) => b.totalBalance - a.totalBalance);
  }

  async getApSubledgerForConnection(connection: any) {
    if (isMockConnection(connection)) {
      const bills = MOCK_BILLS.QueryResponse.Bill.filter(b => parseFloat(b.Balance) > 0);
      const grouped = new Map<string, { totalBalance: number; bills: any[] }>();
      for (const bill of bills) {
        const name = bill.VendorRef.name;
        if (!grouped.has(name)) grouped.set(name, { totalBalance: 0, bills: [] });
        const g = grouped.get(name)!;
        g.totalBalance += parseFloat(bill.Balance);
        g.bills.push(bill);
      }
      return Array.from(grouped.entries())
        .map(([vendorName, data]) => ({ vendorName, ...data }))
        .sort((a, b) => b.totalBalance - a.totalBalance);
    }
    const data = await this.queryForConnection<any>(
      connection,
      'SELECT * FROM Bill MAXRESULTS 200'
    );
    const bills: any[] = data?.QueryResponse?.Bill || [];
    const unpaid = bills.filter(b => parseFloat(b.Balance || '0') > 0);
    const grouped = new Map<string, { totalBalance: number; bills: any[] }>();
    for (const bill of unpaid) {
      const name = bill.VendorRef?.name ?? 'Unknown';
      if (!grouped.has(name)) grouped.set(name, { totalBalance: 0, bills: [] });
      const g = grouped.get(name)!;
      g.totalBalance += parseFloat(bill.Balance || '0');
      g.bills.push(bill);
    }
    return Array.from(grouped.entries())
      .map(([vendorName, data]) => ({ vendorName, ...data }))
      .sort((a, b) => b.totalBalance - a.totalBalance);
  }

  async updateAccountForConnection(
    connection: any,
    id: string,
    data: { name?: string; description?: string; active?: boolean }
  ) {
    if (isMockConnection(connection)) {
      return { Id: id, Name: data.name ?? 'Updated Account', Active: data.active ?? true, SyncToken: '1' };
    }
    const current = await this.makeRequestForConnection<any>(connection, `account/${id}`);
    const a = current.Account;
    // sparse: true tells QB to only update the fields we send, ignoring all others
    // Only Id, SyncToken, and the fields being changed — nothing else to avoid 2010 errors
    const body: Record<string, unknown> = {
      sparse: true,
      Id: a.Id,
      SyncToken: a.SyncToken,
    };
    if (data.name !== undefined) body.Name = data.name;
    if (data.description !== undefined) body.Description = data.description;
    if (data.active !== undefined) body.Active = data.active;
    const res = await this.makeRequestForConnection<any>(connection, 'account', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.Account;
  }

  // ─── Demo data seeding ─────────────────────────────────────────────────────

  async seedDemoTransactionsForConnection(connection: any, year = new Date().getFullYear()): Promise<{ created: string[]; errors: string[] }> {
    if (isMockConnection(connection)) {
      return { created: ['mock: 5 sales receipts, 3 bills, 2 invoices'], errors: [] };
    }

    const created: string[] = [];
    const errors: string[] = [];
    const y = year;

    const safeCreate = async (label: string, fn: () => Promise<void>) => {
      try { await fn(); created.push(label); } catch (e: any) { errors.push(`${label}: ${e.message}`); }
    };

    // ── Resolve / create income account ──────────────────────────────────────
    let incomeAcctId = await this.findAccountByNameForConnection(connection, 'Donations - General');
    if (!incomeAcctId) incomeAcctId = await this.findAccountByNameForConnection(connection, 'Undeposited Funds');

    // ── Sales Receipts (donations) ───────────────────────────────────────────
    const donors = [
      { name: 'Marcus Williams', email: 'marcus@example.com', amount: 250, date: `${y}-01-05`, desc: 'General Donation' },
      { name: 'Sarah Chen',      email: 'sarah@example.com',  amount: 500, date: `${y}-01-08`, desc: 'After-School Program' },
      { name: 'Jennifer Lopez',  email: 'jlopez@example.com', amount: 1000,date: `${y}-01-15`, desc: 'Summer Camp Fund' },
      { name: 'Patricia Davis',  email: 'pdavis@example.com', amount: 500, date: `${y}-02-03`, desc: 'General Donation' },
      { name: 'James Wilson',    email: 'jwilson@example.com',amount: 2500,date: `${y}-02-07`, desc: 'After-School Program' },
    ];

    for (const d of donors) {
      await safeCreate(`Sales Receipt – ${d.name} $${d.amount}`, async () => {
        let custId = await this.findCustomerByNameForConnection(connection, d.name);
        if (!custId) {
          const c = await this.createCustomerForConnection(connection, { displayName: d.name, email: d.email });
          custId = c.id;
        }
        const body: Record<string, unknown> = {
          CustomerRef: { value: custId },
          TxnDate: d.date,
          CustomerMemo: { value: d.desc },
          Line: [{ Amount: d.amount, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { UnitPrice: d.amount, Qty: 1 }, Description: d.desc }],
        };
        if (incomeAcctId) (body.Line as any[])[0].SalesItemLineDetail.ItemRef = undefined; // use default item
        await this.makeRequestForConnection<any>(connection, 'salesreceipt', { method: 'POST', body: JSON.stringify(body) });
      });
    }

    // ── Bills (expenses) ─────────────────────────────────────────────────────
    const expenseAcctId = await this.findAccountByNameForConnection(connection, 'Utilities') ??
                          await this.findAccountByNameForConnection(connection, 'Rent or Lease');

    const bills = [
      { vendor: 'Downtown Building Management', amount: 2400, date: `${y}-02-01`, memo: 'February rent' },
      { vendor: 'City Electric Co.',             amount: 285,  date: `${y}-02-10`, memo: 'February electricity' },
      { vendor: 'Office Depot',                  amount: 450,  date: `${y}-01-20`, memo: 'Office supplies' },
    ];

    for (const b of bills) {
      if (!expenseAcctId) { errors.push(`Bill – ${b.vendor}: no expense account found`); continue; }
      await safeCreate(`Bill – ${b.vendor} $${b.amount}`, async () => {
        let vendorId = await this.findVendorByNameForConnection(connection, b.vendor);
        if (!vendorId) {
          const v = await this.createVendorForConnection(connection, { displayName: b.vendor });
          vendorId = v.id;
        }
        const body = {
          VendorRef: { value: vendorId },
          TxnDate: b.date,
          PrivateNote: b.memo,
          Line: [{ Amount: b.amount, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: expenseAcctId } }, Description: b.memo }],
        };
        await this.makeRequestForConnection<any>(connection, 'bill', { method: 'POST', body: JSON.stringify(body) });
      });
    }

    return { created, errors };
  }

  // ─── Lookup helpers ────────────────────────────────────────────────────────

  async findCustomerByNameForConnection(connection: any, name: string): Promise<string | null> {
    if (isMockConnection(connection)) return `mock-cust-${name.toLowerCase().replace(/\s+/g, '-')}`;

    const escaped = name.replace(/'/g, "\\'");
    const res = await this.queryForConnection<any>(
      connection,
      `SELECT * FROM Customer WHERE DisplayName = '${escaped}' MAXRESULTS 1`
    );
    return res?.QueryResponse?.Customer?.[0]?.Id ?? null;
  }

  async findVendorByNameForConnection(connection: any, name: string): Promise<string | null> {
    if (isMockConnection(connection)) return `mock-vend-${name.toLowerCase().replace(/\s+/g, '-')}`;

    const escaped = name.replace(/'/g, "\\'");
    const res = await this.queryForConnection<any>(
      connection,
      `SELECT * FROM Vendor WHERE DisplayName = '${escaped}' MAXRESULTS 1`
    );
    return res?.QueryResponse?.Vendor?.[0]?.Id ?? null;
  }

  async findAccountByNameForConnection(connection: any, name: string): Promise<string | null> {
    if (isMockConnection(connection)) return `mock-acct-${name.toLowerCase().replace(/\s+/g, '-')}`;

    const escaped = name.replace(/'/g, "\\'");
    const res = await this.queryForConnection<any>(
      connection,
      `SELECT * FROM Account WHERE Name = '${escaped}' MAXRESULTS 1`
    );
    return res?.QueryResponse?.Account?.[0]?.Id ?? null;
  }

  async findItemByNameForConnection(connection: any, name: string): Promise<string | null> {
    const escaped = name.replace(/'/g, "\\'");
    const res = await this.queryForConnection<any>(
      connection,
      `SELECT * FROM Item WHERE Name = '${escaped}' MAXRESULTS 1`
    );
    return res?.QueryResponse?.Item?.[0]?.Id ?? null;
  }

  // ─── Write methods ─────────────────────────────────────────────────────────

  async createCustomerForConnection(
    connection: any,
    data: { displayName: string; email?: string; phone?: string; companyName?: string; billingAddress?: string }
  ): Promise<{ id: string }> {
    if (isMockConnection(connection)) return { id: `mock-cust-${Date.now()}` };
    const body: Record<string, unknown> = { DisplayName: data.displayName };
    if (data.companyName) body.CompanyName = data.companyName;
    if (data.email) body.PrimaryEmailAddr = { Address: data.email };
    if (data.phone) body.PrimaryPhone = { FreeFormNumber: data.phone };
    if (data.billingAddress) {
      body.BillAddr = { Line1: data.billingAddress };
    }
    const res = await this.makeRequestForConnection<any>(connection, 'customer', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { id: res.Customer.Id };
  }

  async createVendorForConnection(
    connection: any,
    data: { displayName: string; email?: string; phone?: string; companyName?: string }
  ): Promise<{ id: string }> {
    if (isMockConnection(connection)) return { id: `mock-vend-${Date.now()}` };
    const body: Record<string, unknown> = { DisplayName: data.displayName };
    if (data.companyName) body.CompanyName = data.companyName;
    if (data.email) body.PrimaryEmailAddr = { Address: data.email };
    if (data.phone) body.PrimaryPhone = { FreeFormNumber: data.phone };
    const res = await this.makeRequestForConnection<any>(connection, 'vendor', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { id: res.Vendor.Id };
  }

  async createInvoiceForConnection(
    connection: any,
    data: {
      customerName: string;
      items: { name: string; qty?: number; unitPrice: number }[];
      dueDate?: string;
      invoiceDate?: string;
      memo?: string;
    }
  ): Promise<{ id: string; docNumber: string }> {
    if (isMockConnection(connection)) {
      const id = `mock-inv-${Date.now()}`;
      return { id, docNumber: `INV-MOCK-${Math.floor(Math.random() * 9000 + 1000)}` };
    }
    // Resolve customer ID — auto-create if not found
    let customerId = await this.findCustomerByNameForConnection(connection, data.customerName);
    if (!customerId) {
      const newCustomer = await this.createCustomerForConnection(connection, { displayName: data.customerName });
      customerId = newCustomer.id;
    }

    // Build line items
    const lines = await Promise.all(
      data.items.map(async (item) => {
        const itemId = await this.findItemByNameForConnection(connection, item.name);
        const detail: Record<string, unknown> = {
          UnitPrice: item.unitPrice,
          Qty: item.qty ?? 1,
        };
        if (itemId) detail.ItemRef = { value: itemId, name: item.name };
        return {
          Amount: item.unitPrice * (item.qty ?? 1),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: detail,
          Description: item.name,
        };
      })
    );

    const body: Record<string, unknown> = {
      CustomerRef: { value: customerId },
      Line: lines,
    };
    if (data.invoiceDate) body.TxnDate = data.invoiceDate;
    if (data.dueDate) body.DueDate = data.dueDate;
    if (data.memo) body.CustomerMemo = { value: data.memo };

    const res = await this.makeRequestForConnection<any>(connection, 'invoice', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { id: res.Invoice.Id, docNumber: res.Invoice.DocNumber };
  }

  async createItemForConnection(
    connection: any,
    data: { name: string; description?: string; unitPrice?: number; type?: string }
  ): Promise<{ id: string }> {
    const itemType = data.type ?? 'Service';
    const body: Record<string, unknown> = {
      Name: data.name,
      Type: itemType,
    };
    if (data.description) body.Description = data.description;
    if (data.unitPrice !== undefined) {
      body.UnitPrice = data.unitPrice;
    }
    // Service/NonInventory items need an IncomeAccountRef — use a sensible default query
    const incomeAccountId = await this.findAccountByNameForConnection(connection, 'Services');
    if (incomeAccountId) body.IncomeAccountRef = { value: incomeAccountId };

    const res = await this.makeRequestForConnection<any>(connection, 'item', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { id: res.Item.Id };
  }

  async createAccountForConnection(
    connection: any,
    data: { name: string; accountType: string; description?: string; accountNumber?: string }
  ): Promise<{ id: string }> {
    const body: Record<string, unknown> = {
      Name: data.name,
      AccountType: data.accountType,
    };
    if (data.description) body.Description = data.description;
    if (data.accountNumber) body.AcctNum = data.accountNumber;
    const res = await this.makeRequestForConnection<any>(connection, 'account', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { id: res.Account.Id };
  }

  /**
   * Create a QB Bill split across programs per an allocation rule.
   * Each line item gets the QB Class of the corresponding program.
   */
  async createBillWithAllocationForConnection(   
    connection: any,
    bill: {
      vendor: string;
      totalAmount: number;
      expenseAccount: string;
      date: string;
      memo?: string;
    },
    splits: { programId: string; percentage: number; qbClassId?: string | null }[]
  ): Promise<{ id: string; docNumber?: string }> {
    if (isMockConnection(connection)) {
      return { id: `mock-bill-${Date.now()}`, docNumber: `BILL-MOCK-${Math.floor(Math.random() * 9000 + 1000)}` };
    }
    // Resolve vendor — auto-create if not found
    let vendorId = await this.findVendorByNameForConnection(connection, bill.vendor);
    if (!vendorId) {
      const newVendor = await this.createVendorForConnection(connection, { displayName: bill.vendor });
      vendorId = newVendor.id;
    }

    // Resolve expense account — try exact match then fuzzy (LIKE) fallback
    let accountId = await this.findAccountByNameForConnection(connection, bill.expenseAccount);
    if (!accountId) {
      const fuzzy = await this.queryForConnection<any>(
        connection,
        `SELECT * FROM Account WHERE Name LIKE '%${bill.expenseAccount.replace(/'/g, "\\'")}%' MAXRESULTS 1`
      );
      accountId = fuzzy?.QueryResponse?.Account?.[0]?.Id ?? null;
    }
    if (!accountId) {
      throw new Error(
        `Expense account "${bill.expenseAccount}" not found in QuickBooks. ` +
        `Please use the exact account name from your Chart of Accounts (e.g. "Office Supplies", "Utilities").`
      );
    }

    // Build line items — distribute amount across splits (round to 2 dp; remainder to largest)
    const sortedSplits = [...splits].sort((a, b) => b.percentage - a.percentage);
    let remaining = Math.round(bill.totalAmount * 100);
    const lines = sortedSplits.map((sp, idx) => {
      const lineAmount = idx === sortedSplits.length - 1
        ? remaining / 100
        : Math.round((bill.totalAmount * sp.percentage) / 100 * 100) / 100;
      remaining -= Math.round(lineAmount * 100);

      const lineDetail: Record<string, unknown> = { AccountRef: { value: accountId } };
      if (sp.qbClassId) lineDetail.ClassRef = { value: sp.qbClassId };

      return {
        Amount: lineAmount,
        DetailType: 'AccountBasedExpenseLineDetail',
        AccountBasedExpenseLineDetail: lineDetail,
        Description: bill.memo ?? bill.vendor,
      };
    });

    const body: Record<string, unknown> = {
      VendorRef: { value: vendorId },
      TxnDate: bill.date,
      Line: lines,
    };
    if (bill.memo) body.PrivateNote = bill.memo;

    const res = await this.makeRequestForConnection<any>(connection, 'bill', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { id: res.Bill.Id, docNumber: res.Bill.DocNumber };
  }

  /**
   * Create a QB Class for a program/grant/location.
   * Returns the QB Class ID.
   */
  async createClassForConnection(connection: any, name: string): Promise<{ id: string }> {
    if (isMockConnection(connection)) return { id: `mock-class-${Date.now()}` };
    const res = await this.makeRequestForConnection<any>(connection, 'class', {
      method: 'POST',
      body: JSON.stringify({ Name: name }),
    });
    return { id: res.Class.Id };
  }

  /**
   * Create a QB Sales Receipt (gross amount) + linked Expense (fee) for a donation transaction.
   * Returns QB Sales Receipt ID.
   */
  async createDonationWithFeeForConnection(
    connection: any,
    tx: {
      transactionId: string;
      donorName: string;
      donorEmail?: string;
      grossAmount: number;
      fee: number;
      date: string;
      description: string;
    }
  ): Promise<{ salesReceiptId: string; expenseId?: string }> {
    if (isMockConnection(connection)) {
      return { salesReceiptId: `mock-sr-${Date.now()}`, expenseId: tx.fee > 0 ? `mock-exp-${Date.now()}` : undefined };
    }
    // Resolve or create customer
    let customerId = await this.findCustomerByNameForConnection(connection, tx.donorName);
    if (!customerId) {
      const newCustomer = await this.createCustomerForConnection(connection, {
        displayName: tx.donorName,
        email: tx.donorEmail,
      });
      customerId = newCustomer.id;
    }

    // Create Sales Receipt for gross amount
    const receiptBody: Record<string, unknown> = {
      CustomerRef: { value: customerId },
      TxnDate: tx.date,
      CustomerMemo: { value: tx.description || 'Donation' },
      Line: [
        {
          Amount: tx.grossAmount,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: { UnitPrice: tx.grossAmount, Qty: 1 },
          Description: `Donation from ${tx.donorName}`,
        },
      ],
    };

    const receiptRes = await this.makeRequestForConnection<any>(connection, 'salesreceipt', {
      method: 'POST',
      body: JSON.stringify(receiptBody),
    });
    const salesReceiptId: string = receiptRes.SalesReceipt.Id;

    // If there is a fee, create an Expense entry
    let expenseId: string | undefined;
    if (tx.fee > 0) {
      // Find or use a default "Platform Fees" expense account
      let accountId = await this.findAccountByNameForConnection(connection, 'Platform Fees');
      if (!accountId) {
        accountId = await this.findAccountByNameForConnection(connection, 'Bank Charges');
      }

      // Find the bank/checking account to use as the payment account
      let bankAccountId = await this.findAccountByNameForConnection(connection, 'Checking Account');
      if (!bankAccountId) {
        bankAccountId = await this.findAccountByNameForConnection(connection, 'Checking');
      }

      const expenseBody: Record<string, unknown> = {
        PaymentType: 'Cash',
        TxnDate: tx.date,
        PrivateNote: `Platform fee for Sales Receipt #${salesReceiptId} (${tx.donorName})`,
        ...(bankAccountId ? { AccountRef: { value: bankAccountId } } : {}),
        Line: [
          {
            Amount: tx.fee,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: accountId
              ? { AccountRef: { value: accountId } }
              : {},
            Description: `Platform fee — ${tx.description || tx.donorName}`,
          },
        ],
      };

      const expenseRes = await this.makeRequestForConnection<any>(connection, 'purchase', {
        method: 'POST',
        body: JSON.stringify(expenseBody),
      });
      expenseId = expenseRes.Purchase?.Id;
    }

    return { salesReceiptId, expenseId };
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
