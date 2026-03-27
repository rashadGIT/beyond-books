import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import type { QuickBooksConnection } from '@prisma/client';
import { getQuickBooksService } from './quickbooksService';

const MAX_RESULT_CHARS = 12_000;

function toText(data: unknown): string {
  const s = JSON.stringify(data, null, 2);
  return s.length > MAX_RESULT_CHARS ? s.slice(0, MAX_RESULT_CHARS) + '\n... [truncated]' : s;
}

/**
 * Creates an in-process MCP Server + Client pair connected via InMemoryTransport.
 * All 6 QuickBooks tools are registered with handlers bound to the given connection.
 * The returned Client can call listTools() and callTool() using real MCP protocol —
 * no HTTP round-trips, works with any AI provider.
 */
export async function createQbMcpClient(connection: QuickBooksConnection): Promise<Client> {
  const server = new McpServer({ name: 'quickbooks-mcp', version: '1.0.0' });
  const qbs = getQuickBooksService();

  server.tool(
    'get_company_info',
    'Get the QuickBooks company name, address, and basic business information',
    {},
    async () => ({ content: [{ type: 'text' as const, text: toText(await qbs.getCompanyInfoForConnection(connection)) }] })
  );

  server.tool(
    'get_sales_receipts',
    'Retrieve sales receipts from QuickBooks. Optionally filter by date range.',
    {
      startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
    },
    async (args) => ({ content: [{ type: 'text' as const, text: toText(await qbs.getSalesReceiptsForConnection(connection, args.startDate, args.endDate)) }] })
  );

  server.tool(
    'get_invoices',
    'Retrieve invoices from QuickBooks. Optionally filter by date range.',
    {
      startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
    },
    async (args) => ({ content: [{ type: 'text' as const, text: toText(await qbs.getInvoicesForConnection(connection, args.startDate, args.endDate)) }] })
  );

  server.tool(
    'get_payments',
    'Retrieve customer payments recorded in QuickBooks. Optionally filter by date range.',
    {
      startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
    },
    async (args) => ({ content: [{ type: 'text' as const, text: toText(await qbs.getPaymentsForConnection(connection, args.startDate, args.endDate)) }] })
  );

  server.tool(
    'get_unpaid_invoices',
    'Retrieve invoices that still have an outstanding balance (money owed to you). Returns invoices where Balance > 0.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: toText(await qbs.getUnpaidInvoicesForConnection(connection)) }] })
  );

  server.tool(
    'run_custom_query',
    'Run a custom QuickBooks IDS query. Only SELECT queries are allowed. QB IDS supports WHERE operators: =, !=, LIKE, IN, BETWEEN, CONTAINS (not > or <). Example: SELECT * FROM Customer MAXRESULTS 50',
    {
      query: z.string().describe('QuickBooks SQL-like SELECT query. Example: SELECT * FROM Customer MAXRESULTS 50'),
    },
    async (args) => {
      if (!args.query.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
      }
      return { content: [{ type: 'text' as const, text: toText(await qbs.queryForConnection(connection, args.query)) }] };
    }
  );

  server.tool(
    'get_accounts',
    'List the full Chart of Accounts with current balances, account types, and subtypes.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: toText(await qbs.getAccountsForConnection(connection)) }] })
  );

  server.tool(
    'get_general_ledger',
    'General Ledger report — every transaction per account for a date range. Use for detailed account activity.',
    {
      startDate: z.string().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().describe('End date in YYYY-MM-DD format'),
    },
    async (args) => {
      const shiftYear = (date: string, delta: number) => {
        const d = new Date(date);
        d.setFullYear(d.getFullYear() + delta);
        return d.toISOString().slice(0, 10);
      };
      const isEmpty = (r: any) => !r || (Array.isArray(r.sections) && r.sections.every((s: any) => !s.lines?.length));

      let result = await qbs.getGeneralLedgerForConnection(connection, args.startDate, args.endDate);
      let usedStart = args.startDate, usedEnd = args.endDate, yearNote = '';

      if (isEmpty(result)) {
        for (const delta of [-2, -3, -1]) {
          const s = shiftYear(args.startDate, delta), e = shiftYear(args.endDate, delta);
          result = await qbs.getGeneralLedgerForConnection(connection, s, e);
          if (!isEmpty(result)) { usedStart = s; usedEnd = e; yearNote = ` (Note: no data found for ${args.startDate}–${args.endDate}; showing ${usedStart}–${usedEnd} instead)`; break; }
        }
      }

      if (isEmpty(result)) {
        return { content: [{ type: 'text' as const, text: `No general ledger data found across multiple date ranges. The QuickBooks account may be empty or not fully set up.` }] };
      }
      return { content: [{ type: 'text' as const, text: toText(result) + yearNote }] };
    }
  );

  server.tool(
    'get_trial_balance',
    'Trial Balance report — net debit/credit per account for a period. Use for period-end review or to check if books balance.',
    {
      startDate: z.string().describe('Start date in YYYY-MM-DD format'),
      endDate: z.string().describe('End date in YYYY-MM-DD format'),
    },
    async (args) => {
      const shiftYear = (date: string, delta: number) => {
        const d = new Date(date);
        d.setFullYear(d.getFullYear() + delta);
        return d.toISOString().slice(0, 10);
      };
      const isEmpty = (r: any) => !r || (Array.isArray(r.sections) && r.sections.every((s: any) => !s.lines?.length));

      let result = await qbs.getTrialBalanceForConnection(connection, args.startDate, args.endDate);
      let usedStart = args.startDate, usedEnd = args.endDate, yearNote = '';

      if (isEmpty(result)) {
        // Try -2 years, then -3 years (covers QB sandbox sample data ~2019-2023)
        for (const delta of [-2, -3, -1]) {
          const s = shiftYear(args.startDate, delta), e = shiftYear(args.endDate, delta);
          result = await qbs.getTrialBalanceForConnection(connection, s, e);
          if (!isEmpty(result)) { usedStart = s; usedEnd = e; yearNote = ` (Note: no data found for ${args.startDate}–${args.endDate}; showing ${usedStart}–${usedEnd} instead)`; break; }
        }
      }

      if (isEmpty(result)) {
        return { content: [{ type: 'text' as const, text: `No trial balance data found across multiple date ranges. The QuickBooks account may be empty or not fully set up.` }] };
      }
      return { content: [{ type: 'text' as const, text: toText(result) + yearNote }] };
    }
  );

  server.tool(
    'get_ar_subledger',
    'Open (unpaid) invoices grouped by customer with total balance owed. Use for collections or aging analysis.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: toText(await qbs.getArSubledgerForConnection(connection)) }] })
  );

  server.tool(
    'get_ap_subledger',
    'Open (unpaid) bills grouped by vendor with total amount owed. Use for cash flow or vendor payables.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: toText(await qbs.getApSubledgerForConnection(connection)) }] })
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'chat-client', version: '1.0.0' }, { capabilities: {} });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return client;
}
