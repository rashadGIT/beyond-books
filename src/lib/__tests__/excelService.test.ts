import { ExcelService } from '../excelService';

describe('ExcelService.getTemplateRows', () => {
  it('returns sample row for invoices entity type', () => {
    const rows = ExcelService.getTemplateRows('invoices');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('CustomerName');
    expect(rows[0]).toHaveProperty('ItemName');
    expect(rows[0]).toHaveProperty('Quantity');
    expect(rows[0]).toHaveProperty('UnitPrice');
    expect(rows[0]).toHaveProperty('DueDate');
    expect(rows[0]).toHaveProperty('Memo');
  });

  it('returns sample row for customers entity type', () => {
    const rows = ExcelService.getTemplateRows('customers');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('DisplayName');
    expect(rows[0]).toHaveProperty('Email');
    expect(rows[0]).toHaveProperty('Phone');
  });

  it('returns sample row for vendors entity type', () => {
    const rows = ExcelService.getTemplateRows('vendors');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('DisplayName');
    expect(rows[0]).toHaveProperty('CompanyName');
  });

  it('returns sample row for products entity type', () => {
    const rows = ExcelService.getTemplateRows('products');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('Name');
    expect(rows[0]).toHaveProperty('UnitPrice');
    expect(rows[0]).toHaveProperty('Type');
  });

  it('returns sample row for chart_of_accounts entity type', () => {
    const rows = ExcelService.getTemplateRows('chart_of_accounts');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveProperty('Name');
    expect(rows[0]).toHaveProperty('AccountType');
    expect(rows[0]).toHaveProperty('AccountNumber');
  });

  it('throws for an unknown entity type', () => {
    expect(() => ExcelService.getTemplateRows('unknown_type')).toThrow('Unknown entity type');
  });
});

describe('ExcelService.getImportColumns', () => {
  it('returns columns for invoices', () => {
    const cols = ExcelService.getImportColumns('invoices');
    expect(cols).toContain('CustomerName');
    expect(cols).toContain('ItemName');
  });

  it('returns empty array for unknown type', () => {
    const cols = ExcelService.getImportColumns('does_not_exist');
    expect(cols).toEqual([]);
  });
});

describe('ExcelService.getExportColumns', () => {
  it('returns columns for invoices export', () => {
    const cols = ExcelService.getExportColumns('invoices');
    expect(cols).toContain('Invoice #');
    expect(cols).toContain('Customer');
    expect(cols).toContain('Status');
  });

  it('returns columns for payments export', () => {
    const cols = ExcelService.getExportColumns('payments');
    expect(cols).toContain('Payment #');
    expect(cols).toContain('Amount');
  });

  it('returns columns for sales_receipts export', () => {
    const cols = ExcelService.getExportColumns('sales_receipts');
    expect(cols).toContain('Receipt #');
    expect(cols).toContain('Customer/Donor');
  });

  it('returns empty array for unknown export type', () => {
    expect(ExcelService.getExportColumns('nonexistent')).toEqual([]);
  });
});

describe('ExcelService.mapInvoiceToRow', () => {
  it('maps a full invoice object correctly', () => {
    const inv = {
      DocNumber: 'INV-001',
      CustomerRef: { name: 'Acme Corp' },
      TxnDate: '2024-01-15',
      DueDate: '2024-02-15',
      TotalAmt: 1500,
      Balance: 0,
    };
    const row = ExcelService.mapInvoiceToRow(inv);
    expect(row['Invoice #']).toBe('INV-001');
    expect(row['Customer']).toBe('Acme Corp');
    expect(row['Date']).toBe('2024-01-15');
    expect(row['Due Date']).toBe('2024-02-15');
    expect(row['Total Amount']).toBe(1500);
    expect(row['Balance Due']).toBe(0);
    expect(row['Status']).toBe('Paid');
  });

  it('sets Status to Unpaid when balance is nonzero', () => {
    const inv = {
      DocNumber: 'INV-002',
      CustomerRef: { name: 'Beta LLC' },
      TxnDate: '2024-01-20',
      DueDate: '2024-02-20',
      TotalAmt: 500,
      Balance: 250,
    };
    const row = ExcelService.mapInvoiceToRow(inv);
    expect(row['Status']).toBe('Unpaid');
  });

  it('handles missing fields with empty string defaults', () => {
    const row = ExcelService.mapInvoiceToRow({});
    expect(row['Invoice #']).toBe('');
    expect(row['Customer']).toBe('');
    expect(row['Date']).toBe('');
    expect(row['Status']).toBe('Paid'); // Balance defaults to '0'
  });

  it('handles missing CustomerRef gracefully', () => {
    const inv = { DocNumber: 'INV-003', Balance: 100 };
    const row = ExcelService.mapInvoiceToRow(inv);
    expect(row['Customer']).toBe('');
    expect(row['Status']).toBe('Unpaid');
  });
});

describe('ExcelService.mapPaymentToRow', () => {
  it('maps a full payment object correctly', () => {
    const pmt = {
      DocNumber: 'PMT-001',
      CustomerRef: { name: 'John Doe' },
      TxnDate: '2024-03-01',
      TotalAmt: 750,
      PaymentMethodRef: { name: 'Check' },
    };
    const row = ExcelService.mapPaymentToRow(pmt);
    expect(row['Payment #']).toBe('PMT-001');
    expect(row['Customer']).toBe('John Doe');
    expect(row['Date']).toBe('2024-03-01');
    expect(row['Amount']).toBe(750);
    expect(row['Payment Method']).toBe('Check');
  });

  it('handles missing fields with empty string defaults', () => {
    const row = ExcelService.mapPaymentToRow({});
    expect(row['Payment #']).toBe('');
    expect(row['Customer']).toBe('');
    expect(row['Payment Method']).toBe('');
  });

  it('handles missing CustomerRef gracefully', () => {
    const pmt = { DocNumber: 'PMT-002', TotalAmt: 100 };
    const row = ExcelService.mapPaymentToRow(pmt);
    expect(row['Customer']).toBe('');
  });
});

describe('ExcelService.mapSalesReceiptToRow', () => {
  it('maps a full sales receipt with line items', () => {
    const sr = {
      DocNumber: 'SR-001',
      CustomerRef: { name: 'Donor A' },
      TxnDate: '2024-04-01',
      TotalAmt: 250,
      Line: [
        { DetailType: 'SalesItemLineDetail', Description: 'Annual Contribution' },
      ],
    };
    const row = ExcelService.mapSalesReceiptToRow(sr);
    expect(row['Receipt #']).toBe('SR-001');
    expect(row['Customer/Donor']).toBe('Donor A');
    expect(row['Date']).toBe('2024-04-01');
    expect(row['Amount']).toBe(250);
    expect(row['Description']).toBe('Annual Contribution');
  });

  it('returns empty description when no SalesItemLineDetail line', () => {
    const sr = {
      DocNumber: 'SR-002',
      CustomerRef: { name: 'Donor B' },
      TxnDate: '2024-04-02',
      TotalAmt: 100,
      Line: [{ DetailType: 'SubTotalLineDetail' }],
    };
    const row = ExcelService.mapSalesReceiptToRow(sr);
    expect(row['Description']).toBe('');
  });

  it('handles missing Line array', () => {
    const sr = { DocNumber: 'SR-003', TotalAmt: 50 };
    const row = ExcelService.mapSalesReceiptToRow(sr);
    expect(row['Description']).toBe('');
    expect(row['Customer/Donor']).toBe('');
  });

  it('handles empty Line array', () => {
    const sr = { DocNumber: 'SR-004', Line: [] };
    const row = ExcelService.mapSalesReceiptToRow(sr);
    expect(row['Description']).toBe('');
  });
});

describe('ExcelService.generateExcel', () => {
  it('returns a Buffer', () => {
    const rows = [{ Name: 'Alice', Amount: 100 }];
    const buf = ExcelService.generateExcel(rows, 'TestSheet');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});

describe('ExcelService.generateCSV', () => {
  it('returns empty string for empty rows array', () => {
    expect(ExcelService.generateCSV([])).toBe('');
  });

  it('returns CSV string with headers and data', () => {
    const rows = [{ Name: 'Alice', Amount: 100 }];
    const csv = ExcelService.generateCSV(rows);
    expect(csv).toContain('Name');
    expect(csv).toContain('Alice');
    expect(csv).toContain('100');
  });
});
