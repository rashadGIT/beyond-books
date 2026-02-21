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

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'chat-client', version: '1.0.0' }, { capabilities: {} });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return client;
}
