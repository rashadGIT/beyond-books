import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuickBooksService } from '@/lib/quickbooksService';

export const QB_TOOLS = [
  {
    name: 'get_company_info',
    description: 'Get the QuickBooks company name, address, and basic business information',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_sales_receipts',
    description: 'Retrieve sales receipts from QuickBooks. Optionally filter by date range.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
    },
  },
  {
    name: 'get_invoices',
    description: 'Retrieve invoices from QuickBooks. Optionally filter by date range.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
    },
  },
  {
    name: 'get_payments',
    description: 'Retrieve customer payments recorded in QuickBooks. Optionally filter by date range.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
    },
  },
  {
    name: 'get_unpaid_invoices',
    description: 'Retrieve invoices that still have an outstanding balance (i.e., money owed to you). Returns invoices where Balance > 0.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'run_custom_query',
    description: 'Run a custom QuickBooks IDS query. Only SELECT queries are allowed. IMPORTANT: QB IDS only supports these WHERE operators: =, !=, LIKE, IN, BETWEEN, CONTAINS. It does NOT support > or < operators. Example: SELECT * FROM Customer MAXRESULTS 50',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'QuickBooks SQL-like query. Example: SELECT * FROM Customer MAXRESULTS 50',
        },
      },
      required: ['query'],
    },
  },
];

export async function GET() {
  return NextResponse.json({ tools: QB_TOOLS });
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tool, input } = await request.json();

  const connection = await prisma.quickBooksConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    return NextResponse.json(
      { error: 'QuickBooks is not connected. Please connect it in Settings.' },
      { status: 400 }
    );
  }

  const qbService = getQuickBooksService();

  try {
    let result: unknown;

    switch (tool) {
      case 'get_company_info':
        result = await qbService.getCompanyInfoForConnection(connection);
        break;

      case 'get_sales_receipts':
        result = await qbService.getSalesReceiptsForConnection(
          connection,
          input?.startDate,
          input?.endDate
        );
        break;

      case 'get_invoices':
        result = await qbService.getInvoicesForConnection(
          connection,
          input?.startDate,
          input?.endDate
        );
        break;

      case 'get_payments':
        result = await qbService.getPaymentsForConnection(
          connection,
          input?.startDate,
          input?.endDate
        );
        break;

      case 'get_unpaid_invoices':
        result = await qbService.getUnpaidInvoicesForConnection(connection);
        break;

      case 'run_custom_query': {
        const query = input?.query as string;
        if (!query || !query.trim().toUpperCase().startsWith('SELECT')) {
          return NextResponse.json({ error: 'Only SELECT queries are allowed' }, { status: 400 });
        }
        result = await qbService.queryForConnection<unknown>(connection, query);
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error(`[mcp] Tool "${tool}" threw:`, error?.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
