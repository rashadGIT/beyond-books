import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateAIResponse, AIMessage, AIOverride } from '@/lib/aiProviders';
import type { AITool } from '@/lib/aiProviders';
import { createQbMcpClient } from '@/lib/qbMcpExecutor';
import { JobService } from '@/lib/jobService';
import { PDFService } from '@/lib/pdfService';
import { ExcelService } from '@/lib/excelService';

function buildSystemPrompt() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isoDate = new Date().toISOString().slice(0, 10);
  return `You are a helpful financial assistant for nonprofit and small business accounting.
You have access to the user's QuickBooks data through tools.
When asked about finances, donors, transactions, customers, invoices, or payments, use the available tools to look up real data before answering.
Present numbers clearly, use plain English, and offer actionable insights where helpful.
If QuickBooks is not connected, let the user know they can connect it in Settings.
If a tool call fails or returns an error, include the exact error message in your response so the user can diagnose the problem. Do not give a vague "I'm unable to connect" message — quote the actual error text.

QuickBooks IDS query language limitations for run_custom_query: only supports WHERE operators =, !=, LIKE, IN, BETWEEN, CONTAINS. It does NOT support > or < comparisons. To find unpaid invoices (Balance > 0), use the get_unpaid_invoices tool instead of a custom query.

You can also schedule recurring AI tasks for this user using the create_scheduled_job tool. When someone asks you to schedule, automate, or set up a recurring report or query, use create_scheduled_job directly — do NOT tell them to set it up manually in QuickBooks. Ask for frequency (DAILY, WEEKLY, HOURLY) and time of day if not provided, then call the tool.
You can also run an existing scheduled task immediately using the run_scheduled_job tool. When the user asks to run, execute, or trigger a task by name, use this tool with the task label.
You can generate a downloadable PDF report using the generate_report_pdf tool. When the user asks to save results as a PDF or download a report, call this tool with the report title and the full content you want in the PDF.

You can export QuickBooks data (invoices, payments, or sales receipts) to a downloadable Excel or CSV file using the export_to_spreadsheet tool. When the user asks to export, download, or get a spreadsheet of their QB data, use this tool.
You can provide a blank import template for any entity type using the download_spreadsheet_template tool. When the user asks for a template or wants to know the format to import customers, vendors, invoices, products, or accounts, use this tool.
After the user uploads a filled spreadsheet (via the import button), you can push that data into QuickBooks using the import_to_quickbooks tool. When the user says they've uploaded a file and wants to import it, use this tool with the correct entityType.

You can create QuickBooks bills split across programs using create_bill_with_allocation. Load the user's allocation rules with get_allocation_rules to confirm which rule to use, then call create_bill_with_allocation with the vendor, amount, expense account, and allocationRuleId. QuickBooks must be connected.
IMPORTANT: Before calling create_bill_with_allocation, always call get_accounts first to find the exact expense account name in the user's Chart of Accounts. Never guess account names. If the user says "office supplies", look up the accounts, find the closest matching expense account (e.g. "Office Supplies", "Supplies", "Office Expenses"), and use that exact name. Only ask the user to clarify if there is genuinely no matching expense account at all.
You can manage programs, locations, and grants using create_program and list_programs. Allocation rules (percentage splits across programs) can be created with create_allocation_rule and retrieved with get_allocation_rules. When the user asks to create a program, grant, or split rule, use these tools.
When a user uploads a donation file, first call detect_platform_file(fileId) to identify the platform and summarize the contents. Report findings to the user (platform, row count, fee columns) and ask if they want to proceed. Then call import_platform_file(fileId) to write the transactions to the database.
When the user uploads a donation file that includes platform fees (e.g. PayPal or Stripe), use the separate_donation_fees tool to create a QB Sales Receipt for the gross amount and a linked QB Expense for the fee for each transaction. Ask the user to confirm before running this.
You can seed realistic demo transactions into QuickBooks using seed_demo_transactions. Use this when the user asks to add dummy, test, sample, or demo data to QuickBooks. It creates sales receipts (donations) and bills for the specified year.

You can read and update the organization's letter branding using get_org_branding and update_org_branding. Use these when the user asks to change the org name, tax ID, signer, brand color, or any detail that appears on donation acknowledgment letters.

You can view ledger and subledger data from QuickBooks:
- get_accounts: List the full Chart of Accounts with current balances and account types/subtypes.
- get_general_ledger(startDate, endDate): General Ledger report — every transaction per account for the period (YYYY-MM-DD). Use for detailed account activity. If the result says no data found for that range, automatically retry with the equivalent period one or two years earlier (e.g. if Jan–Feb 2026 is empty, try Jan–Feb 2024 or Jan–Feb 2023) and tell the user which period was used.
- get_trial_balance(startDate, endDate): Trial Balance — net debit/credit per account. Use for period-end review or to check if books balance. If the result says no data found for that range, automatically retry with the equivalent period one or two years earlier and tell the user which period was used.
- get_ar_subledger: Open invoices grouped by customer with total balance owed. Use for collections or aging analysis.
- get_ap_subledger: Open bills grouped by vendor with total amount owed. Use for cash flow or vendor payables.
- update_account(id, name?, description?, active?): Update a QuickBooks account name, description, or active status. Always call get_accounts first to find the account ID. If the exact name isn't found, pick the closest matching account automatically and proceed — do NOT stop to ask the user to confirm the name. Only ask if there are multiple equally plausible matches.

Today's date is ${today} (${isoDate}). Use this when interpreting relative dates like "this month", "last month", "this year", "recent", etc.`;
}

const CREATE_SCHEDULED_JOB_TOOL: AITool = {
  name: 'create_scheduled_job',
  description: 'Schedule a recurring AI task that runs automatically on a set schedule. Use this when the user asks to schedule, automate, or set up a recurring report or query.',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'A short friendly name for the task (e.g. "Weekly Donor Summary")' },
      prompt: { type: 'string', description: 'The AI prompt to run on schedule (e.g. "Show me all donations from last week")' },
      frequency: { type: 'string', enum: ['HOURLY', 'DAILY', 'WEEKLY'], description: 'How often to run' },
      schedule: { type: 'string', description: 'Time of day to run, e.g. "09:00 AM"' },
    },
    required: ['label', 'prompt', 'frequency', 'schedule'],
  },
};

const GENERATE_PDF_TOOL: AITool = {
  name: 'generate_report_pdf',
  description: 'Generate a downloadable PDF report from the current data or analysis. Use this when the user asks to save or download the results as a PDF file.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Title of the PDF report (e.g. "Top Donors 2026")' },
      content: { type: 'string', description: 'The full report content in plain text or markdown to include in the PDF' },
    },
    required: ['title', 'content'],
  },
};

const RUN_SCHEDULED_JOB_TOOL: AITool = {
  name: 'run_scheduled_job',
  description: 'Run a scheduled task immediately by its name. Use this when the user asks to run, execute, or trigger a scheduled task by name.',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'The exact name of the scheduled task to run (e.g. "Weekly Donor Summary")' },
    },
    required: ['label'],
  },
};

const EXPORT_SPREADSHEET_TOOL: AITool = {
  name: 'export_to_spreadsheet',
  description: 'Export QuickBooks data (invoices, payments, or sales receipts) to a downloadable Excel or CSV file.',
  inputSchema: {
    type: 'object',
    properties: {
      dataType: { type: 'string', enum: ['invoices', 'payments', 'sales_receipts'], description: 'Type of QB data to export' },
      startDate: { type: 'string', description: 'Start date filter YYYY-MM-DD (optional)' },
      endDate: { type: 'string', description: 'End date filter YYYY-MM-DD (optional)' },
      format: { type: 'string', enum: ['xlsx', 'csv'], description: 'File format (default: xlsx)' },
    },
    required: ['dataType'],
  },
};

const DOWNLOAD_TEMPLATE_TOOL: AITool = {
  name: 'download_spreadsheet_template',
  description: 'Generate a blank Excel or CSV import template with correct column headers for a given entity type.',
  inputSchema: {
    type: 'object',
    properties: {
      entityType: { type: 'string', enum: ['invoices', 'customers', 'vendors', 'products', 'chart_of_accounts'], description: 'Entity type to generate a template for' },
      format: { type: 'string', enum: ['xlsx', 'csv'], description: 'File format (default: xlsx)' },
    },
    required: ['entityType'],
  },
};

const IMPORT_SPREADSHEET_TOOL: AITool = {
  name: 'import_to_quickbooks',
  description: "Parse the user's most recently uploaded QB spreadsheet and bulk-create records in QuickBooks. Use after the user uploads a filled template via the import button.",
  inputSchema: {
    type: 'object',
    properties: {
      entityType: { type: 'string', enum: ['invoices', 'customers', 'vendors', 'products', 'chart_of_accounts'], description: 'Type of records being imported' },
    },
    required: ['entityType'],
  },
};

const CREATE_BILL_WITH_ALLOCATION_TOOL: AITool = {
  name: 'create_bill_with_allocation',
  description: 'Create a QuickBooks bill split across programs using a named allocation rule or explicit splits. Each line item is assigned the corresponding QB Class.',
  inputSchema: {
    type: 'object',
    properties: {
      vendor: { type: 'string', description: 'Vendor name (auto-created in QB if not found)' },
      totalAmount: { type: 'number', description: 'Total bill amount in dollars' },
      expenseAccount: { type: 'string', description: 'Expense account name (e.g. "Office Supplies")' },
      allocationRuleName: { type: 'string', description: 'Name of a saved allocation rule (e.g. "Admin Overhead Split"). Use get_allocation_rules to list available rules.' },
      date: { type: 'string', description: 'Bill date YYYY-MM-DD (defaults to today)' },
      memo: { type: 'string', description: 'Optional memo or description' },
    },
    required: ['vendor', 'totalAmount', 'expenseAccount'],
  },
};

const CREATE_PROGRAM_TOOL: AITool = {
  name: 'create_program',
  description: 'Create a program, location, or grant for allocation tracking. Automatically syncs a matching QB Class if QuickBooks is connected.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name of the program/location/grant' },
      type: { type: 'string', enum: ['PROGRAM', 'LOCATION', 'GRANT'], description: 'Type of allocation target' },
    },
    required: ['name', 'type'],
  },
};

const LIST_PROGRAMS_TOOL: AITool = {
  name: 'list_programs',
  description: 'Return all active programs, locations, and grants for this user.',
  inputSchema: { type: 'object', properties: {}, required: [] },
};

const CREATE_ALLOCATION_RULE_TOOL: AITool = {
  name: 'create_allocation_rule',
  description: 'Create a named allocation rule with percentage splits across programs. Splits must sum to 100%.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Rule name (e.g. "Admin Overhead Split")' },
      splits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            programName: { type: 'string', description: 'Exact program name (e.g. "After-School Program")' },
            percentage: { type: 'number', description: 'Percentage (0-100)' },
          },
          required: ['programName', 'percentage'],
        },
        description: 'Array of { programName, percentage } — must sum to 100',
      },
    },
    required: ['name', 'splits'],
  },
};

const GET_ALLOCATION_RULES_TOOL: AITool = {
  name: 'get_allocation_rules',
  description: 'Return all allocation rules with their program splits for this user.',
  inputSchema: { type: 'object', properties: {}, required: [] },
};

const CLASSIFY_DONORS_TOOL: AITool = {
  name: 'classify_donor_intent',
  description: 'Use AI to classify donations as RESTRICTED (designated to a specific fund or program) or GENERAL (unrestricted). Writes results back to the database and can assign QB Classes for restricted donations if QB is connected.',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'Classify all unclassified transactions from a specific import file' },
      transactionIds: { type: 'array', items: { type: 'string' }, description: 'Classify specific transaction IDs' },
    },
    required: [],
  },
};

const DETECT_PLATFORM_TOOL: AITool = {
  name: 'detect_platform_file',
  description: 'Analyze an uploaded donation file to identify its source platform (PayPal, Network for Good, Kindful, or generic) and return a summary of transaction count, date range, fee columns detected, and anomalies. Call this after the user uploads a file before importing it.',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'ID of the uploaded ProcessedFile to analyze' },
    },
    required: ['fileId'],
  },
};

const IMPORT_PLATFORM_TOOL: AITool = {
  name: 'import_platform_file',
  description: 'Import a detected donation platform file into the database as DonationTransaction records. Run detect_platform_file first and confirm with the user before calling this.',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'ID of the uploaded ProcessedFile to import' },
      skipRefunds: { type: 'boolean', description: 'Skip rows flagged as refunds (default: true)' },
    },
    required: ['fileId'],
  },
};

const SEPARATE_FEES_TOOL: AITool = {
  name: 'separate_donation_fees',
  description: 'For transactions that have a platform fee (e.g. PayPal or Stripe fees), create a QB Sales Receipt for the gross donation amount and a linked QB Expense for the fee. Skips transactions that have already been processed.',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'Process all fee-bearing transactions from a specific import file' },
      transactionIds: { type: 'array', items: { type: 'string' }, description: 'Process specific transaction IDs instead of a full file' },
    },
    required: [],
  },
};

const GET_ORG_BRANDING_TOOL: AITool = {
  name: 'get_org_branding',
  description: 'Return the current organization branding configuration (org name, tagline, tax ID, signer name/title, logo URL, primary color).',
  inputSchema: { type: 'object', properties: {}, required: [] },
};

const UPDATE_ORG_BRANDING_TOOL: AITool = {
  name: 'update_org_branding',
  description: 'Update one or more fields of the organization letter branding. Use when the user asks to change the org name, tagline, tax ID, signer name or title, logo, or brand color.',
  inputSchema: {
    type: 'object',
    properties: {
      orgName: { type: 'string', description: 'Organization name shown in letter header' },
      tagLine: { type: 'string', description: 'Tagline or mission statement shown under org name' },
      taxId: { type: 'string', description: 'Tax-exempt EIN (e.g. "84-1234567")' },
      signerName: { type: 'string', description: 'Name of the letter signer' },
      signerTitle: { type: 'string', description: 'Title of the letter signer (e.g. "Executive Director")' },
      logoUrl: { type: 'string', description: 'URL to the organization logo image' },
      primaryColor: { type: 'string', description: 'Brand color as a hex code (e.g. "#2563eb")' },
    },
    required: [],
  },
};

const UPDATE_ACCOUNT_TOOL: AITool = {
  name: 'update_account',
  description: 'Update a QuickBooks account name, description, or active status. Always call get_accounts first to get the account ID. If the exact name is not found, pick the closest matching account and proceed without asking the user.',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'QuickBooks Account ID (get from get_accounts)' },
      name: { type: 'string', description: 'New account name' },
      description: { type: 'string', description: 'Account description' },
      active: { type: 'boolean', description: 'Set to false to deactivate the account' },
    },
    required: ['id'],
  },
};

const SEED_DEMO_TRANSACTIONS_TOOL: AITool = {
  name: 'seed_demo_transactions',
  description: 'Create a set of realistic demo transactions in QuickBooks (sales receipts, bills) for the current or specified year. Use when the user asks to add dummy/test/demo/sample transactions or data to QuickBooks.',
  inputSchema: {
    type: 'object',
    properties: {
      year: { type: 'number', description: `4-digit year to create transactions in (defaults to ${new Date().getFullYear()})` },
    },
  },
};

const MAX_TOOL_ITERATIONS = 5;

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { timestamp: 'asc' },
    });
    return NextResponse.json(messages);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { role, content, fileId } = body ?? {};

    if (!role || typeof role !== 'string') {
      return NextResponse.json({ error: `Invalid request: missing role (got ${JSON.stringify(role)})` }, { status: 400 });
    }
    if (content === undefined || content === null) {
      return NextResponse.json({ error: 'Invalid request: missing content' }, { status: 400 });
    }

    // Ensure user record exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@unknown.local`,
        name: request.headers.get('x-user-name') || undefined,
      },
    });

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: { userId, role, content, hasAttachment: !!fileId, fileId },
    });

    if (role !== 'user') {
      return NextResponse.json(userMessage);
    }

    // Load recent conversation history (last 20 messages)
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    const messages: AIMessage[] = history
      .reverse()
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Build in-process MCP client if QB is connected — dynamic tool discovery, no static list
    const qbConnection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
    const mcpClient = qbConnection ? await createQbMcpClient(qbConnection) : null;
    const qbTools: AITool[] = mcpClient
      ? (await mcpClient.listTools()).tools.map(t => ({
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema as AITool['inputSchema'],
        }))
      : [];
    const tools: AITool[] = [...qbTools, CREATE_SCHEDULED_JOB_TOOL, RUN_SCHEDULED_JOB_TOOL, GENERATE_PDF_TOOL, EXPORT_SPREADSHEET_TOOL, DOWNLOAD_TEMPLATE_TOOL, IMPORT_SPREADSHEET_TOOL, CLASSIFY_DONORS_TOOL, DETECT_PLATFORM_TOOL, IMPORT_PLATFORM_TOOL, SEPARATE_FEES_TOOL, CREATE_BILL_WITH_ALLOCATION_TOOL, CREATE_PROGRAM_TOOL, LIST_PROGRAMS_TOOL, CREATE_ALLOCATION_RULE_TOOL, GET_ALLOCATION_RULES_TOOL, GET_ORG_BRANDING_TOOL, UPDATE_ORG_BRANDING_TOOL, UPDATE_ACCOUNT_TOOL, SEED_DEMO_TRANSACTIONS_TOOL];

    // Load user's personal AI settings if they have one saved
    const userAISettings = await prisma.aISettings.findFirst({ where: { userId, isActive: true } });
    const aiOverride: AIOverride | undefined = userAISettings
      ? { provider: userAISettings.provider as AIOverride['provider'], apiKey: userAISettings.apiKey, model: userAISettings.model }
      : undefined;

    // Agentic loop: call AI → execute tools → call AI again → repeat until no more tool calls
    let finalContent = '';
    let iterationCount = 0;
    const loopMessages = [...messages];

    while (iterationCount < MAX_TOOL_ITERATIONS) {
      iterationCount++;

      let aiResponse;
      try {
        aiResponse = await generateAIResponse(buildSystemPrompt(), loopMessages, tools, aiOverride);
      } catch (aiError: unknown) {
        finalContent = `I'm having trouble connecting to the AI service. Please check the AI configuration. (${(aiError as Error).message})`;
        break;
      }

      if (!aiResponse.toolCalls || aiResponse.toolCalls.length === 0) {
        finalContent = aiResponse.content;
        break;
      }

      // Execute each tool call via in-process MCP
      const toolResults: Array<{ id: string; name: string; content: string }> = [];
      const MAX_RESULT_CHARS = 12_000;

      for (const toolCall of aiResponse.toolCalls) {
        let resultContent: string;

        if (toolCall.name === 'export_to_spreadsheet') {
          try {
            const input = toolCall.input as { dataType: string; startDate?: string; endDate?: string; format?: string };
            const validTypes = ['invoices', 'payments', 'sales_receipts'];
            if (!validTypes.includes(input.dataType)) throw new Error(`Invalid dataType. Must be one of: ${validTypes.join(', ')}`);

            const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
            if (!connection) throw new Error('QuickBooks not connected');

            const { getQuickBooksService } = await import('@/lib/quickbooksService');
            const qbSvc = getQuickBooksService();
            let rows: Record<string, unknown>[] = [];

            if (input.dataType === 'invoices') {
              const data = await qbSvc.getInvoicesForConnection(connection, input.startDate, input.endDate);
              rows = (data?.QueryResponse?.Invoice ?? []).map(ExcelService.mapInvoiceToRow);
            } else if (input.dataType === 'payments') {
              const data = await qbSvc.getPaymentsForConnection(connection, input.startDate, input.endDate);
              rows = (data?.QueryResponse?.Payment ?? []).map(ExcelService.mapPaymentToRow);
            } else {
              const data = await qbSvc.getSalesReceiptsForConnection(connection, input.startDate, input.endDate);
              rows = (data?.QueryResponse?.SalesReceipt ?? []).map(ExcelService.mapSalesReceiptToRow);
            }
            if (rows.length === 0) rows = [{}];

            const fmt = input.format ?? 'xlsx';
            const timestamp = Date.now();
            const filename = `${input.dataType}-${timestamp}.${fmt}`;
            const { default: fs } = await import('fs');
            const { default: path } = await import('path');
            const exportsDir = path.join(process.cwd(), 'public', 'exports');
            if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

            if (fmt === 'csv') {
              fs.writeFileSync(path.join(exportsDir, filename), Buffer.from(ExcelService.generateCSV(rows), 'utf-8'));
            } else {
              fs.writeFileSync(path.join(exportsDir, filename), ExcelService.generateExcel(rows, input.dataType));
            }

            const label = input.dataType.replace(/_/g, ' ');
            resultContent = `Spreadsheet exported (${rows.length} records). [Download ${label}.${fmt}](/exports/${filename})`;
          } catch (err) {
            resultContent = `Failed to export spreadsheet: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'download_spreadsheet_template') {
          try {
            const input = toolCall.input as { entityType: string; format?: string };
            const fmt = input.format ?? 'xlsx';
            const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
            // Build the template URL — the route returns a redirect so we capture the final URL
            const templateUrl = `${baseUrl}/api/spreadsheet/template?type=${input.entityType}&format=${fmt}`;
            // Fetch to resolve the redirect and get the presigned URL
            const res = await fetch(templateUrl, {
              method: 'GET',
              headers: { 'x-user-id': userId },
              redirect: 'manual',
            });
            const downloadUrl = res.headers.get('location') ?? templateUrl;
            const label = input.entityType.replace(/_/g, ' ');
            resultContent = `Here is the blank ${label} import template. Fill in the columns and upload it using the spreadsheet import button.\n\n[Download ${label} template.${fmt}](${downloadUrl})`;
          } catch (err) {
            resultContent = `Failed to generate template: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'import_to_quickbooks') {
          try {
            const input = toolCall.input as { entityType: string };
            const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
            const res = await fetch(`${baseUrl}/api/spreadsheet/import`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
              body: JSON.stringify({ entityType: input.entityType }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? 'Import failed');
            const label = input.entityType.replace(/_/g, ' ');
            let summary = `Import complete: **${data.created}** ${label} created`;
            if (data.skipped > 0) {
              summary += `, **${data.skipped}** skipped`;
              const errorLines = data.errors.slice(0, 5).map((e: { row: number; reason: string }) => `- Row ${e.row}: ${e.reason}`).join('\n');
              summary += `\n\n${errorLines}`;
              if (data.errors.length > 5) summary += `\n- ...and ${data.errors.length - 5} more`;
            }
            resultContent = summary;
          } catch (err) {
            resultContent = `Failed to import: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'generate_report_pdf') {
          try {
            const input = toolCall.input as { title: string; content: string };
            const downloadUrl = await PDFService.generateReportPDF(input.title, input.content);
            resultContent = `PDF generated successfully. [Download "${input.title}"](${downloadUrl})`;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            resultContent = `Failed to generate PDF: ${msg}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'run_scheduled_job') {
          try {
            const input = toolCall.input as { label: string };
            const job = await prisma.scheduledJob.findFirst({
              where: { userId, label: input.label },
            });
            if (!job) {
              resultContent = `No scheduled task named "${input.label}" found. Check the task name and try again.`;
            } else {
              const execution = await JobService.runJob(job.id);
              resultContent = execution.status === 'completed'
                ? `Task "${job.label}" ran successfully.\n\n${execution.result}`
                : `Task "${job.label}" failed: ${execution.result}`;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            resultContent = `Failed to run scheduled task: ${msg}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'create_scheduled_job') {
          try {
            const input = toolCall.input as { label: string; prompt: string; frequency: string; schedule: string };
            const job = await JobService.createJob(userId, {
              label: input.label,
              prompt: input.prompt,
              frequency: input.frequency,
              schedule: input.schedule,
            });
            resultContent = `Scheduled job created successfully. Job ID: ${job.id}. Label: "${job.label}". Runs ${job.frequency?.toLowerCase()} at ${job.schedule}.`;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            resultContent = `Failed to create scheduled job: ${msg}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'create_bill_with_allocation') {
          const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
          if (!connection || !connection.isActive) {
            resultContent = 'QuickBooks is not connected. Please connect your account in Settings before creating bills.';
            toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
            continue;
          }
          try {
            const input = toolCall.input as {
              vendor: string; totalAmount: number; expenseAccount: string;
              allocationRuleName?: string; date?: string; memo?: string;
            };
            const date = input.date ?? new Date().toISOString().slice(0, 10);

            // Load allocation splits by rule name (case-insensitive)
            let splits: { programId: string; percentage: number; qbClassId?: string | null }[] = [];
            if (input.allocationRuleName) {
              const allRules = await prisma.allocationRule.findMany({
                where: { userId },
                include: { splits: { include: { program: true } } },
              });
              const rule = allRules.find((r: any) =>
                r.name.toLowerCase() === input.allocationRuleName!.toLowerCase()
              ) ?? allRules.find((r: any) =>
                r.name.toLowerCase().includes(input.allocationRuleName!.toLowerCase())
              );
              if (!rule) {
                const names = allRules.map((r: any) => `"${r.name}"`).join(', ');
                throw new Error(`Allocation rule "${input.allocationRuleName}" not found. Available rules: ${names || 'none'}`);
              }
              splits = rule.splits.map((sp: any) => ({ programId: sp.programId, percentage: sp.percentage, qbClassId: sp.program.qbClassId }));
            }

            if (!splits.length) throw new Error('No splits found — provide allocationRuleId or ensure the rule has splits');

            const { getQuickBooksService } = await import('@/lib/quickbooksService');
            const qbSvc = getQuickBooksService();
            const bill = await qbSvc.createBillWithAllocationForConnection(connection, {
              vendor: input.vendor,
              totalAmount: input.totalAmount,
              expenseAccount: input.expenseAccount,
              date,
              memo: input.memo,
            }, splits);

            resultContent = `Bill created: $${input.totalAmount.toFixed(2)} to ${input.vendor}, split across ${splits.length} program(s). QB Bill ID: ${bill.id}${bill.docNumber ? ` (#${bill.docNumber})` : ''}.`;
          } catch (err) {
            resultContent = `Failed to create bill: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'create_program') {
          try {
            const input = toolCall.input as { name: string; type: string };
            const validTypes = ['PROGRAM', 'LOCATION', 'GRANT'];
            if (!input.name || !input.type) throw new Error('name and type are required');
            if (!validTypes.includes(input.type)) throw new Error(`type must be one of ${validTypes.join(', ')}`);

            // Sync QB Class if connected (best-effort)
            let qbClassId: string | undefined;
            try {
              const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
              if (connection?.isActive) {
                const { getQuickBooksService } = await import('@/lib/quickbooksService');
                const qbSvc = getQuickBooksService();
                const cls = await qbSvc.createClassForConnection(connection, input.name);
                qbClassId = cls.id;
              }
            } catch {
              // QB not connected or failed — continue without QB Class
            }

            const program = await prisma.program.create({
              data: { userId, name: input.name, type: input.type, qbClassId },
            });
            resultContent = `Program created: "${program.name}" (${program.type})${program.qbClassId ? ` — QB Class ID: ${program.qbClassId}` : ' (QB Class not synced — QB not connected)'}. Program ID: ${program.id}`;
          } catch (err) {
            resultContent = `Failed to create program: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'list_programs') {
          try {
            const programs = await prisma.program.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: 'asc' } });
            resultContent = programs.length
              ? JSON.stringify(programs)
              : 'No programs found. Create one with create_program.';
          } catch (err) {
            resultContent = `Failed to list programs: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'create_allocation_rule') {
          try {
            const input = toolCall.input as { name: string; splits: { programName: string; percentage: number }[] };
            if (!input.name || !input.splits?.length) throw new Error('name and splits are required');

            const total = input.splits.reduce((s, sp) => s + sp.percentage, 0);
            if (Math.abs(total - 100) > 0.01) throw new Error(`Splits must sum to 100% (got ${total}%)`);

            // Resolve program names → IDs
            const programs = await prisma.program.findMany({ where: { userId, isActive: true } });
            const resolvedSplits = input.splits.map(sp => {
              const prog = programs.find(p => p.name.toLowerCase() === sp.programName.toLowerCase());
              if (!prog) throw new Error(`Program not found: "${sp.programName}". Available: ${programs.map(p => p.name).join(', ')}`);
              return { programId: prog.id, percentage: sp.percentage };
            });

            const rule = await prisma.allocationRule.create({
              data: {
                userId,
                name: input.name,
                splits: { create: resolvedSplits },
              },
              include: { splits: { include: { program: true } } },
            });
            resultContent = `Allocation rule created: "${rule.name}" with ${rule.splits.length} splits (${rule.splits.map(s => `${s.program.name}: ${s.percentage}%`).join(', ')}). Rule ID: ${rule.id}`;
          } catch (err) {
            resultContent = `Failed to create allocation rule: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'get_allocation_rules') {
          try {
            const rules = await prisma.allocationRule.findMany({
              where: { userId },
              include: { splits: { include: { program: true } } },
            });
            resultContent = rules.length ? JSON.stringify(rules) : 'No allocation rules found.';
          } catch (err) {
            resultContent = `Failed to get allocation rules: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'classify_donor_intent') {
          try {
            const input = toolCall.input as { fileId?: string; transactionIds?: string[] };
            const where: Record<string, unknown> = { classification: 'UNCLASSIFIED' };
            if (input.fileId) where.fileId = input.fileId;
            if (input.transactionIds?.length) where.id = { in: input.transactionIds };

            const transactions = await prisma.donationTransaction.findMany({ where: where as any, take: 100 });
            if (transactions.length === 0) {
              resultContent = 'No unclassified transactions found.';
              toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
              continue;
            }

            const { classifyDonations } = await import('@/lib/classificationService');
            const classResults = await classifyDonations(
              transactions.map(tx => ({ id: tx.id, donorName: tx.donorName, description: tx.description, grossAmount: tx.grossAmount }))
            );

            let restricted = 0, general = 0;
            for (const cr of classResults) {
              await prisma.donationTransaction.update({
                where: { id: cr.id },
                data: {
                  classification: cr.classification,
                  restrictedFund: cr.restrictedFund ?? null,
                  classificationConf: cr.confidence,
                },
              });
              if (cr.classification === 'RESTRICTED') restricted++;
              else general++;
            }

            resultContent = `Classification complete: ${restricted} RESTRICTED, ${general} GENERAL out of ${classResults.length} transactions.`;
          } catch (err) {
            resultContent = `Classification failed: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'detect_platform_file' || toolCall.name === 'import_platform_file') {
          try {
            const input = toolCall.input as { fileId: string; skipRefunds?: boolean };
            const processedFile = await prisma.processedFile.findFirst({ where: { id: input.fileId, userId } });
            if (!processedFile?.filePath) {
              resultContent = `File ${input.fileId} not found or has no stored path.`;
              toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
              continue;
            }

            const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
            const { ExcelService } = await import('@/lib/excelService');
            const { detectParser } = await import('@/lib/platformImporters');

            const s3 = new S3Client({ region: 'us-east-1' });
            const s3Res = await s3.send(new GetObjectCommand({ Bucket: process.env.BB_S3_BUCKET, Key: processedFile.filePath }));
            const chunks: Uint8Array[] = [];
            for await (const chunk of s3Res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);

            const rawRows = ExcelService.parseFile(buffer, processedFile.filename) as Record<string, string>[];
            if (rawRows.length === 0) {
              resultContent = 'File is empty or could not be parsed.';
              toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
              continue;
            }

            const headers = Object.keys(rawRows[0]);
            const parser = detectParser(headers);

            if (toolCall.name === 'detect_platform_file') {
              const platform = parser?.platform ?? 'generic/unknown';
              const feeColFound = headers.some(h => h.toLowerCase().includes('fee'));
              const preview = parser ? parser.parse(rawRows.slice(0, 3)) : [];
              const dates = preview.map(r => r.date).filter(Boolean);
              resultContent = JSON.stringify({
                platform,
                rowCount: rawRows.length,
                feeColumnsDetected: feeColFound,
                sampleDates: dates,
                headers: headers.slice(0, 10),
                message: parser
                  ? `Detected ${platform} export with ${rawRows.length} rows. ${feeColFound ? 'Fee column found.' : 'No fee column.'}`
                  : `Could not detect platform. Headers: ${headers.slice(0, 6).join(', ')}`,
              });
            } else {
              // import_platform_file
              if (!parser) {
                resultContent = `Could not detect platform for file ${input.fileId}. Run detect_platform_file first to confirm the format.`;
                toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
                continue;
              }

              const skipRefunds = input.skipRefunds !== false;
              let rows = rawRows;
              if (skipRefunds) {
                rows = rows.filter(r => {
                  const type = (r['Type'] || r['type'] || '').toLowerCase();
                  return !type.includes('refund') && !type.includes('reversal');
                });
              }

              const normalized = parser.parse(rows);
              const cap = 50;
              const batch = normalized.slice(0, cap);

              const totalAmount = batch.reduce((s, t) => s + t.grossAmount, 0);
              const file = await prisma.processedFile.update({
                where: { id: input.fileId },
                data: { source: parser.platform, transactionCount: batch.length, totalAmount },
              });

              const results = { imported: 0, failed: [] as string[] };
              for (const tx of batch) {
                try {
                  await prisma.donationTransaction.create({
                    data: {
                      fileId: file.id,
                      transactionId: tx.transactionId,
                      date: tx.date,
                      source: tx.source,
                      donorName: tx.donorName,
                      donorEmail: tx.donorEmail,
                      grossAmount: tx.grossAmount,
                      fee: tx.fee,
                      netAmount: tx.netAmount,
                      description: tx.description,
                      originalData: JSON.stringify(tx),
                    },
                  });
                  results.imported++;
                } catch (e) {
                  results.failed.push((e as Error).message);
                }
              }

              resultContent = `Imported ${results.imported}/${batch.length} transactions from ${parser.platform} (file: ${processedFile.filename}).${results.failed.length ? ` ${results.failed.length} failed.` : ''} ${normalized.length > cap ? `(Capped at ${cap} — ${normalized.length - cap} remaining rows skipped.)` : ''}`;
            }
          } catch (err) {
            resultContent = `Failed: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'separate_donation_fees') {
          const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
          if (!connection || !connection.isActive) {
            resultContent = 'QuickBooks is not connected. Please connect your account in Settings before using this feature.';
            toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
            continue;
          }
          try {
            const input = toolCall.input as { fileId?: string; transactionIds?: string[] };
            const where: Record<string, unknown> = { fee: { gt: 0 }, qbSalesReceiptId: null };
            if (input.fileId) where.fileId = input.fileId;
            if (input.transactionIds?.length) where.id = { in: input.transactionIds };

            const cap = 50;
            const transactions = await prisma.donationTransaction.findMany({ where: where as any, take: cap });
            const { getQuickBooksService } = await import('@/lib/quickbooksService');
            const qbSvc = getQuickBooksService();
            const results = { created: 0, skipped: 0, failed: [] as { id: string; error: string }[] };

            for (const tx of transactions) {
              try {
                const { salesReceiptId } = await qbSvc.createDonationWithFeeForConnection(connection, {
                  transactionId: tx.transactionId,
                  donorName: tx.donorName,
                  donorEmail: tx.donorEmail || undefined,
                  grossAmount: tx.grossAmount,
                  fee: tx.fee,
                  date: tx.date,
                  description: tx.description,
                });
                await prisma.donationTransaction.update({
                  where: { id: tx.id },
                  data: { qbSalesReceiptId: salesReceiptId },
                });
                results.created++;
              } catch (err) {
                results.failed.push({ id: tx.id, error: (err as Error).message });
              }
            }
            resultContent = `Fee separation complete: ${results.created} QB records created, ${results.skipped} skipped${results.failed.length ? `, ${results.failed.length} failed: ${results.failed.slice(0, 3).map(f => f.error).join('; ')}` : ''}.`;
          } catch (err) {
            resultContent = `Failed to separate fees: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'get_org_branding') {
          try {
            const branding = await prisma.orgBranding.findUnique({ where: { userId } });
            resultContent = branding
              ? JSON.stringify(branding)
              : JSON.stringify({ orgName: 'Your Organization', tagLine: 'Building stronger communities together', taxId: 'XX-XXXXXXX', signerName: 'Your Name', signerTitle: 'Executive Director', primaryColor: '#2563eb' });
          } catch (err) {
            resultContent = `Failed to get branding: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'update_org_branding') {
          try {
            const input = toolCall.input as Record<string, string>;
            const allowed = ['orgName', 'tagLine', 'taxId', 'signerName', 'signerTitle', 'logoUrl', 'primaryColor'] as const;
            const data: Partial<Record<typeof allowed[number], string>> = {};
            for (const key of allowed) {
              if (key in input && typeof input[key] === 'string') data[key] = input[key];
            }
            const branding = await prisma.orgBranding.upsert({
              where: { userId },
              update: data,
              create: { userId, ...data },
            });
            resultContent = `Branding updated successfully: ${JSON.stringify(branding)}`;
          } catch (err) {
            resultContent = `Failed to update branding: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'update_account') {
          const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
          if (!connection?.isActive) {
            resultContent = 'QuickBooks is not connected. Connect in Settings first.';
            toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
            continue;
          }
          try {
            const input = toolCall.input as { id: string; name?: string; description?: string; active?: boolean };
            const { getQuickBooksService } = await import('@/lib/quickbooksService');
            const qbSvc = getQuickBooksService();
            const updated = await qbSvc.updateAccountForConnection(connection, input.id, {
              name: input.name,
              description: input.description,
              active: input.active,
            });
            resultContent = `Account updated: "${updated.Name}" (ID: ${updated.Id}, Active: ${updated.Active}).`;
          } catch (err) {
            resultContent = `Failed to update account: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (toolCall.name === 'seed_demo_transactions') {
          const connection = await prisma.quickBooksConnection.findUnique({ where: { userId } });
          if (!connection?.isActive) {
            resultContent = 'QuickBooks is not connected. Connect in Settings first.';
            toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
            continue;
          }
          try {
            const input = toolCall.input as { year?: number };
            const { getQuickBooksService } = await import('@/lib/quickbooksService');
            const qbSvc = getQuickBooksService();
            const result = await qbSvc.seedDemoTransactionsForConnection(connection, input.year);
            resultContent = `Demo transactions created in QuickBooks:\n${result.created.map(c => `✓ ${c}`).join('\n')}${result.errors.length ? `\n\nErrors:\n${result.errors.map(e => `✗ ${e}`).join('\n')}` : ''}`;
          } catch (err) {
            resultContent = `Failed to seed demo transactions: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        if (!mcpClient) {
          resultContent = `Tool "${toolCall.name}" failed: QuickBooks is not connected.`;
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
          continue;
        }

        try {
          const resultObj = await mcpClient.callTool({
            name: toolCall.name,
            arguments: toolCall.input as Record<string, unknown>,
          });
          const rawText = (resultObj.content as Array<{ type: string; text: string }>)?.[0]?.text
            ?? JSON.stringify(resultObj);
          const truncated = rawText.length > MAX_RESULT_CHARS
            ? rawText.slice(0, MAX_RESULT_CHARS) + '\n... [truncated — too many results]'
            : rawText;
          resultContent = `Tool "${toolCall.name}" result:\n${truncated}`;
        } catch (toolErr) {
          const msg = toolErr instanceof Error ? toolErr.message : String(toolErr);
          console.error(`[chat/mcp] Tool "${toolCall.name}" error:`, msg);
          resultContent = `Tool "${toolCall.name}" failed: ${msg}`;
        }

        toolResults.push({ id: toolCall.id, name: toolCall.name, content: resultContent });
      }

      // Append AI's tool-use turn (with raw tool_calls for OpenAI) and individual tool results
      loopMessages.push({
        role: 'assistant',
        content: aiResponse.content || '',
        _toolCallsRaw: aiResponse.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        })),
      });

      for (const result of toolResults) {
        loopMessages.push({
          role: 'tool',
          content: result.content,
          _toolCallId: result.id,
        });
      }
    }

    if (mcpClient) await mcpClient.close();

    if (!finalContent) {
      finalContent = 'I was unable to complete your request. Please try again.';
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: finalContent },
    });

    return NextResponse.json({ userMessage, assistantMessage });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.chatMessage.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
