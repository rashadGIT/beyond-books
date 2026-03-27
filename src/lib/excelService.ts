import * as XLSX from 'xlsx';

// ─── Column definitions ───────────────────────────────────────────────────────

const EXPORT_COLUMNS: Record<string, string[]> = {
  invoices: ['Invoice #', 'Customer', 'Date', 'Due Date', 'Total Amount', 'Balance Due', 'Status'],
  payments: ['Payment #', 'Customer', 'Date', 'Amount', 'Payment Method'],
  sales_receipts: ['Receipt #', 'Customer/Donor', 'Date', 'Amount', 'Description'],
};

const IMPORT_COLUMNS: Record<string, string[]> = {
  invoices: ['CustomerName', 'ItemName', 'Quantity', 'UnitPrice', 'DueDate', 'Memo'],
  customers: ['DisplayName', 'Email', 'Phone', 'CompanyName', 'BillingAddress'],
  vendors: ['DisplayName', 'Email', 'Phone', 'CompanyName'],
  products: ['Name', 'Description', 'UnitPrice', 'Type'],
  chart_of_accounts: ['Name', 'AccountType', 'Description', 'AccountNumber'],
};

const IMPORT_SAMPLE_ROWS: Record<string, Record<string, string>> = {
  invoices: {
    CustomerName: 'Acme Corp',
    ItemName: 'Consulting Services',
    Quantity: '2',
    UnitPrice: '500',
    DueDate: '2026-03-31',
    Memo: 'Q1 project work',
  },
  customers: {
    DisplayName: 'Jane Smith',
    Email: 'jane@example.com',
    Phone: '555-123-4567',
    CompanyName: 'Smith LLC',
    BillingAddress: '123 Main St, Austin, TX 78701',
  },
  vendors: {
    DisplayName: 'Office Depot',
    Email: 'billing@officedepot.com',
    Phone: '800-555-0199',
    CompanyName: 'Office Depot Inc',
  },
  products: {
    Name: 'Web Design',
    Description: 'Custom website design service',
    UnitPrice: '1500',
    Type: 'Service',
  },
  chart_of_accounts: {
    Name: 'Marketing Expenses',
    AccountType: 'Expense',
    Description: 'All marketing-related costs',
    AccountNumber: '6100',
  },
};

// ─── Excel / CSV generation ───────────────────────────────────────────────────

export class ExcelService {
  /** Generate an Excel (.xlsx) buffer from an array of flat row objects */
  static generateExcel(rows: Record<string, unknown>[], sheetName = 'Sheet1'): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  /** Generate a CSV string from an array of flat row objects */
  static generateCSV(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const ws = XLSX.utils.json_to_sheet(rows);
    return XLSX.utils.sheet_to_csv(ws);
  }

  /**
   * Parse an uploaded Excel or CSV file into an array of row objects.
   * Keys are the header row values.
   */
  static parseFile(buffer: Buffer, filename: string): Record<string, unknown>[] {
    const ext = filename.split('.').pop()?.toLowerCase();
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: false, // parse everything as strings so we can validate later
    });
    return rows;
  }

  /** Return header row + 1 sample row for a given import entity type */
  static getTemplateRows(entityType: string): Record<string, string>[] {
    const columns = IMPORT_COLUMNS[entityType];
    if (!columns) throw new Error(`Unknown entity type: ${entityType}`);
    const sample = IMPORT_SAMPLE_ROWS[entityType] ?? {};
    return [sample]; // json_to_sheet uses keys as header row
  }

  /** Column headers for export data types */
  static getExportColumns(dataType: string): string[] {
    return EXPORT_COLUMNS[dataType] ?? [];
  }

  /** Column headers for import entity types */
  static getImportColumns(entityType: string): string[] {
    return IMPORT_COLUMNS[entityType] ?? [];
  }

  /** Map a raw QB invoice object to a flat export row */
  static mapInvoiceToRow(inv: Record<string, unknown>): Record<string, unknown> {
    const balance = parseFloat(String(inv.Balance ?? '0'));
    return {
      'Invoice #': inv.DocNumber ?? '',
      'Customer': (inv.CustomerRef as Record<string, unknown>)?.name ?? '',
      'Date': inv.TxnDate ?? '',
      'Due Date': inv.DueDate ?? '',
      'Total Amount': inv.TotalAmt ?? '',
      'Balance Due': inv.Balance ?? '',
      'Status': balance === 0 ? 'Paid' : 'Unpaid',
    };
  }

  /** Map a raw QB payment object to a flat export row */
  static mapPaymentToRow(pmt: Record<string, unknown>): Record<string, unknown> {
    return {
      'Payment #': pmt.DocNumber ?? '',
      'Customer': (pmt.CustomerRef as Record<string, unknown>)?.name ?? '',
      'Date': pmt.TxnDate ?? '',
      'Amount': pmt.TotalAmt ?? '',
      'Payment Method': (pmt.PaymentMethodRef as Record<string, unknown>)?.name ?? '',
    };
  }

  /** Map a raw QB sales receipt object to a flat export row */
  static mapSalesReceiptToRow(sr: Record<string, unknown>): Record<string, unknown> {
    const lines = (sr.Line as Record<string, unknown>[]) ?? [];
    const desc = lines.find(l => l.DetailType === 'SalesItemLineDetail')
      ? (lines[0]?.Description ?? '')
      : '';
    return {
      'Receipt #': sr.DocNumber ?? '',
      'Customer/Donor': (sr.CustomerRef as Record<string, unknown>)?.name ?? '',
      'Date': sr.TxnDate ?? '',
      'Amount': sr.TotalAmt ?? '',
      'Description': desc,
    };
  }
}
