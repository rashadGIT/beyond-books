/**
 * Mock QuickBooks API responses for demo/testing mode.
 * Activated when connection.realmId === 'mock-demo-realm'.
 * All data is realistic for Demo Organization nonprofit.
 */

export const MOCK_REALM_ID = 'mock-demo-realm';

export function isMockConnection(connection: { realmId: string }): boolean {
  return connection.realmId === MOCK_REALM_ID;
}

// ─── Company Info ─────────────────────────────────────────────────────────────

export const MOCK_COMPANY_INFO = {
  CompanyInfo: {
    Id: '1',
    CompanyName: 'Demo Organization',
    LegalName: 'Demo Organization',
    CompanyAddr: {
      Line1: '1842 Community Drive',
      City: 'Denver',
      CountrySubDivisionCode: 'CO',
      PostalCode: '80203',
    },
    Email: { Address: 'finance@demoorg.example' },
    WebAddr: { URI: 'https://youthrevive.org' },
    FiscalYearStartMonth: 'January',
    Country: 'US',
  },
  time: new Date().toISOString(),
};

// ─── Chart of Accounts ────────────────────────────────────────────────────────

export const MOCK_ACCOUNTS = {
  QueryResponse: {
    Account: [
      { Id: 'acct-001', AcctNum: '1010', Name: 'Checking Account', AccountType: 'Bank', AccountSubType: 'Checking', CurrentBalance: 45230.50, Active: true, Description: 'Primary operating checking account' },
      { Id: 'acct-002', AcctNum: '1020', Name: 'Savings Account', AccountType: 'Bank', AccountSubType: 'Savings', CurrentBalance: 120000.00, Active: true, Description: 'Program reserve fund' },
      { Id: 'acct-003', AcctNum: '1100', Name: 'Accounts Receivable', AccountType: 'Accounts Receivable', AccountSubType: 'AccountsReceivable', CurrentBalance: 4850.75, Active: true },
      { Id: 'acct-004', AcctNum: '1200', Name: 'Prepaid Expenses', AccountType: 'Other Current Asset', AccountSubType: 'PrepaidExpenses', CurrentBalance: 2400.00, Active: true },
      { Id: 'acct-005', AcctNum: '1500', Name: 'Equipment', AccountType: 'Fixed Asset', AccountSubType: 'FurnitureAndFixtures', CurrentBalance: 18500.00, Active: true },
      { Id: 'acct-006', AcctNum: '2000', Name: 'Accounts Payable', AccountType: 'Accounts Payable', AccountSubType: 'AccountsPayable', CurrentBalance: 3200.00, Active: true },
      { Id: 'acct-007', AcctNum: '2100', Name: 'Payroll Liabilities', AccountType: 'Other Current Liability', AccountSubType: 'PayrollTaxPayable', CurrentBalance: 1850.00, Active: true },
      { Id: 'acct-008', AcctNum: '2200', Name: 'Deferred Revenue', AccountType: 'Other Current Liability', AccountSubType: 'DeferredRevenue', CurrentBalance: 5000.00, Active: true },
      { Id: 'acct-009', AcctNum: '3000', Name: 'Net Assets - Unrestricted', AccountType: 'Equity', AccountSubType: 'OpeningBalanceEquity', CurrentBalance: 181130.25, Active: true },
      { Id: 'acct-010', AcctNum: '3100', Name: 'Net Assets - Restricted', AccountType: 'Equity', AccountSubType: 'RetainedEarnings', CurrentBalance: 22500.00, Active: true },
      { Id: 'acct-011', AcctNum: '4000', Name: 'Donations - General', AccountType: 'Income', AccountSubType: 'NonProfitIncome', CurrentBalance: 0, Active: true },
      { Id: 'acct-012', AcctNum: '4100', Name: 'Donations - Restricted', AccountType: 'Income', AccountSubType: 'NonProfitIncome', CurrentBalance: 0, Active: true },
      { Id: 'acct-013', AcctNum: '4200', Name: 'Government Grants', AccountType: 'Income', AccountSubType: 'NonProfitIncome', CurrentBalance: 0, Active: true },
      { Id: 'acct-014', AcctNum: '4300', Name: 'Program Service Revenue', AccountType: 'Income', AccountSubType: 'ServiceFeeIncome', CurrentBalance: 0, Active: true },
      { Id: 'acct-015', AcctNum: '5000', Name: 'Program Services', AccountType: 'Expense', AccountSubType: 'SuppliesAndMaterials', CurrentBalance: 0, Active: true },
      { Id: 'acct-016', AcctNum: '5100', Name: 'Salaries & Wages', AccountType: 'Expense', AccountSubType: 'ProfessionalFees', CurrentBalance: 0, Active: true },
      { Id: 'acct-017', AcctNum: '5200', Name: 'Payroll Taxes', AccountType: 'Expense', AccountSubType: 'PayrollExpenses', CurrentBalance: 0, Active: true },
      { Id: 'acct-018', AcctNum: '5300', Name: 'Rent', AccountType: 'Expense', AccountSubType: 'Rent', CurrentBalance: 0, Active: true },
      { Id: 'acct-019', AcctNum: '5400', Name: 'Office Supplies', AccountType: 'Expense', AccountSubType: 'SuppliesAndMaterials', CurrentBalance: 0, Active: true },
      { Id: 'acct-020', AcctNum: '5500', Name: 'Platform Fees', AccountType: 'Expense', AccountSubType: 'BankCharges', CurrentBalance: 0, Active: true },
      { Id: 'acct-021', AcctNum: '5600', Name: 'Marketing & Outreach', AccountType: 'Expense', AccountSubType: 'AdvertisingAndMarketing', CurrentBalance: 0, Active: true },
      { Id: 'acct-022', AcctNum: '5700', Name: 'Administrative', AccountType: 'Expense', AccountSubType: 'OtherMiscellaneousServiceCost', CurrentBalance: 0, Active: true },
      { Id: 'acct-023', AcctNum: '5800', Name: 'Fundraising Costs', AccountType: 'Expense', AccountSubType: 'AdvertisingAndMarketing', CurrentBalance: 0, Active: true },
      { Id: 'acct-024', AcctNum: '5900', Name: 'Insurance', AccountType: 'Expense', AccountSubType: 'Insurance', CurrentBalance: 0, Active: true, Description: 'General liability and D&O' },
    ],
    maxResults: 24,
  },
};

// ─── Invoices (AR) ────────────────────────────────────────────────────────────

export const MOCK_INVOICES = {
  QueryResponse: {
    Invoice: [
      {
        Id: 'inv-001', DocNumber: 'INV-1042', TxnDate: '2026-01-15', DueDate: '2026-02-14',
        Balance: '1250.00', TotalAmt: '1250.00',
        CustomerRef: { value: 'cust-001', name: 'Marcus Williams' },
        CustomerMemo: { value: 'After-School Program Q1 enrollment' },
      },
      {
        Id: 'inv-002', DocNumber: 'INV-1043', TxnDate: '2026-02-01', DueDate: '2026-03-03',
        Balance: '500.00', TotalAmt: '500.00',
        CustomerRef: { value: 'cust-002', name: 'Sarah Chen' },
        CustomerMemo: { value: 'Workshop series deposit' },
      },
      {
        Id: 'inv-003', DocNumber: 'INV-1038', TxnDate: '2025-12-20', DueDate: '2026-01-19',
        Balance: '3200.00', TotalAmt: '3200.00',
        CustomerRef: { value: 'cust-003', name: 'Youth Services Coalition' },
        CustomerMemo: { value: 'Partnership services - Q4 2025' },
      },
      {
        Id: 'inv-004', DocNumber: 'INV-1044', TxnDate: '2026-02-20', DueDate: '2026-03-22',
        Balance: '750.00', TotalAmt: '1500.00',
        CustomerRef: { value: 'cust-004', name: 'Denver School District' },
        CustomerMemo: { value: 'Title I curriculum materials (partial payment received)' },
      },
    ],
    maxResults: 4,
  },
};

// ─── Bills (AP) ────────────────────────────────────────────────────────────────

export const MOCK_BILLS = {
  QueryResponse: {
    Bill: [
      {
        Id: 'bill-001', DocNumber: 'BILL-220', TxnDate: '2026-02-01', DueDate: '2026-03-03',
        Balance: '2400.00', TotalAmt: '2400.00',
        VendorRef: { value: 'vend-001', name: 'Downtown Building Management' },
        PrivateNote: 'Monthly office rent - March 2026',
      },
      {
        Id: 'bill-002', DocNumber: 'BILL-221', TxnDate: '2026-02-05', DueDate: '2026-02-20',
        Balance: '285.40', TotalAmt: '285.40',
        VendorRef: { value: 'vend-002', name: 'City Electric Co.' },
        PrivateNote: 'Electricity - January 2026',
      },
      {
        Id: 'bill-003', DocNumber: 'BILL-222', TxnDate: '2026-02-10', DueDate: '2026-03-12',
        Balance: '450.00', TotalAmt: '450.00',
        VendorRef: { value: 'vend-003', name: 'Office Depot' },
        PrivateNote: 'Office supplies order #8842910',
      },
      {
        Id: 'bill-004', DocNumber: 'BILL-219', TxnDate: '2026-01-15', DueDate: '2026-02-14',
        Balance: '1200.00', TotalAmt: '2400.00',
        VendorRef: { value: 'vend-004', name: 'Payroll Solutions LLC' },
        PrivateNote: 'Payroll processing fees Q1 (partial)',
      },
    ],
    maxResults: 4,
  },
};

// ─── Sales Receipts ───────────────────────────────────────────────────────────

export const MOCK_SALES_RECEIPTS = {
  QueryResponse: {
    SalesReceipt: [
      { Id: 'sr-001', DocNumber: 'SR-8041', TxnDate: '2026-01-05', TotalAmt: '250.00', CustomerRef: { name: 'Marcus Williams' } },
      { Id: 'sr-002', DocNumber: 'SR-8042', TxnDate: '2026-01-08', TotalAmt: '500.00', CustomerRef: { name: 'Sarah Chen' } },
      { Id: 'sr-003', DocNumber: 'SR-8043', TxnDate: '2026-01-12', TotalAmt: '100.00', CustomerRef: { name: 'David Okafor' } },
      { Id: 'sr-004', DocNumber: 'SR-8044', TxnDate: '2026-01-15', TotalAmt: '1000.00', CustomerRef: { name: 'Jennifer Lopez' } },
      { Id: 'sr-005', DocNumber: 'SR-8045', TxnDate: '2026-01-19', TotalAmt: '75.00', CustomerRef: { name: 'Robert Kim' } },
      { Id: 'sr-006', DocNumber: 'SR-8046', TxnDate: '2026-02-03', TotalAmt: '500.00', CustomerRef: { name: 'Patricia Davis' } },
      { Id: 'sr-007', DocNumber: 'SR-8047', TxnDate: '2026-02-07', TotalAmt: '2500.00', CustomerRef: { name: 'James Wilson' } },
    ],
    maxResults: 7,
  },
};

// ─── Payments ─────────────────────────────────────────────────────────────────

export const MOCK_PAYMENTS = {
  QueryResponse: {
    Payment: [
      { Id: 'pmt-001', TxnDate: '2026-01-20', TotalAmt: '1250.00', CustomerRef: { name: 'Marcus Williams' } },
      { Id: 'pmt-002', TxnDate: '2026-02-05', TotalAmt: '500.00', CustomerRef: { name: 'Denver School District' } },
      { Id: 'pmt-003', TxnDate: '2026-02-12', TotalAmt: '750.00', CustomerRef: { name: 'Sarah Chen' } },
    ],
    maxResults: 3,
  },
};

// ─── General Ledger (parsed format) ──────────────────────────────────────────
// Returns the ParsedQbReport shape directly (after parseQbReport would have run).

export const MOCK_GENERAL_LEDGER = {
  columns: ['Date', 'Transaction Type', 'No.', 'Name', 'Memo/Description', 'Amount', 'Balance'],
  sections: [
    {
      accountName: 'Checking Account',
      lines: [
        { Date: '2026-01-05', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8041', Name: 'Marcus Williams', 'Memo/Description': 'PayPal Donation', Amount: '250.00', Balance: '44,980.50' },
        { Date: '2026-01-08', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8042', Name: 'Sarah Chen', 'Memo/Description': 'After-School Program', Amount: '500.00', Balance: '45,480.50' },
        { Date: '2026-01-15', 'Transaction Type': 'Bill Payment', 'No.': 'BILL-219', Name: 'Downtown Building Management', 'Memo/Description': 'Monthly rent', Amount: '-2,400.00', Balance: '43,080.50' },
        { Date: '2026-01-19', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8045', Name: 'Robert Kim', 'Memo/Description': 'PayPal Donation', Amount: '75.00', Balance: '43,155.50' },
        { Date: '2026-02-03', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8046', Name: 'Patricia Davis', 'Memo/Description': 'Network for Good Donation', Amount: '500.00', Balance: '43,655.50' },
        { Date: '2026-02-07', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8047', Name: 'James Wilson', 'Memo/Description': 'After-School Program', Amount: '2,500.00', Balance: '46,155.50' },
        { Date: '2026-02-15', 'Transaction Type': 'Bill Payment', 'No.': 'BILL-221', Name: 'City Electric Co.', 'Memo/Description': 'Electricity bill', Amount: '-285.40', Balance: '45,870.10' },
        { Date: '2026-03-01', 'Transaction Type': 'Bill Payment', 'No.': 'BILL-220', Name: 'Downtown Building Management', 'Memo/Description': 'Monthly rent', Amount: '-2,400.00', Balance: '43,470.10' },
        { Date: '2026-03-10', 'Transaction Type': 'Check', 'No.': 'CHK-0091', Name: 'Office Depot', 'Memo/Description': 'Office supplies', Amount: '-239.60', Balance: '43,230.50' },
      ],
      summary: { Date: '', 'Transaction Type': '', 'No.': '', Name: '', 'Memo/Description': 'Total Checking Account', Amount: '1,200.10', Balance: '43,230.50' },
    },
    {
      accountName: 'Donations - General',
      lines: [
        { Date: '2026-01-05', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8041', Name: 'Marcus Williams', 'Memo/Description': 'PayPal Donation', Amount: '250.00', Balance: '250.00' },
        { Date: '2026-01-12', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8043', Name: 'David Okafor', 'Memo/Description': 'PayPal Donation', Amount: '100.00', Balance: '350.00' },
        { Date: '2026-01-19', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8045', Name: 'Robert Kim', 'Memo/Description': 'PayPal Donation', Amount: '75.00', Balance: '425.00' },
        { Date: '2026-02-03', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8046', Name: 'Patricia Davis', 'Memo/Description': 'Network for Good Donation', Amount: '500.00', Balance: '925.00' },
        { Date: '2026-02-14', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8050', Name: 'Linda Thompson', 'Memo/Description': 'Network for Good Donation', Amount: '100.00', Balance: '1,025.00' },
        { Date: '2026-02-24', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8052', Name: 'Susan Martinez', 'Memo/Description': 'Network for Good Donation', Amount: '300.00', Balance: '1,325.00' },
      ],
      summary: { Date: '', 'Transaction Type': '', 'No.': '', Name: '', 'Memo/Description': 'Total Donations - General', Amount: '1,325.00', Balance: '1,325.00' },
    },
    {
      accountName: 'Donations - Restricted',
      lines: [
        { Date: '2026-01-08', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8042', Name: 'Sarah Chen', 'Memo/Description': 'After-School Program', Amount: '500.00', Balance: '500.00' },
        { Date: '2026-01-15', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8044', Name: 'Jennifer Lopez', 'Memo/Description': 'Summer Camp Fund', Amount: '1,000.00', Balance: '1,500.00' },
        { Date: '2026-01-28', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8048', Name: 'Thomas Grant', 'Memo/Description': 'Title I Support', Amount: '150.00', Balance: '1,650.00' },
        { Date: '2026-02-07', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8047', Name: 'James Wilson', 'Memo/Description': 'After-School Program', Amount: '2,500.00', Balance: '4,150.00' },
        { Date: '2026-02-18', 'Transaction Type': 'Sales Receipt', 'No.': 'SR-8051', Name: 'Michael Brown', 'Memo/Description': 'Summer Camp Scholarship', Amount: '750.00', Balance: '4,900.00' },
      ],
      summary: { Date: '', 'Transaction Type': '', 'No.': '', Name: '', 'Memo/Description': 'Total Donations - Restricted', Amount: '4,900.00', Balance: '4,900.00' },
    },
    {
      accountName: 'Salaries & Wages',
      lines: [
        { Date: '2026-01-31', 'Transaction Type': 'Check', 'No.': 'CHK-0082', Name: 'Payroll', 'Memo/Description': 'January payroll', Amount: '-8,500.00', Balance: '-8,500.00' },
        { Date: '2026-02-28', 'Transaction Type': 'Check', 'No.': 'CHK-0088', Name: 'Payroll', 'Memo/Description': 'February payroll', Amount: '-8,500.00', Balance: '-17,000.00' },
      ],
      summary: { Date: '', 'Transaction Type': '', 'No.': '', Name: '', 'Memo/Description': 'Total Salaries & Wages', Amount: '-17,000.00', Balance: '-17,000.00' },
    },
    {
      accountName: 'Rent',
      lines: [
        { Date: '2026-01-15', 'Transaction Type': 'Bill Payment', 'No.': 'BILL-218', Name: 'Downtown Building Management', 'Memo/Description': 'January rent', Amount: '-2,400.00', Balance: '-2,400.00' },
        { Date: '2026-02-15', 'Transaction Type': 'Bill Payment', 'No.': 'BILL-219', Name: 'Downtown Building Management', 'Memo/Description': 'February rent', Amount: '-2,400.00', Balance: '-4,800.00' },
      ],
      summary: { Date: '', 'Transaction Type': '', 'No.': '', Name: '', 'Memo/Description': 'Total Rent', Amount: '-4,800.00', Balance: '-4,800.00' },
    },
  ],
};

// ─── Trial Balance (parsed format) ───────────────────────────────────────────

export const MOCK_TRIAL_BALANCE = {
  columns: ['Account', 'Debit', 'Credit'],
  sections: [
    {
      accountName: 'Balance Sheet',
      lines: [
        { Account: 'Checking Account', Debit: '43,230.50', Credit: '' },
        { Account: 'Savings Account', Debit: '120,000.00', Credit: '' },
        { Account: 'Accounts Receivable', Debit: '4,850.75', Credit: '' },
        { Account: 'Prepaid Expenses', Debit: '2,400.00', Credit: '' },
        { Account: 'Equipment', Debit: '18,500.00', Credit: '' },
        { Account: 'Accounts Payable', Debit: '', Credit: '3,200.00' },
        { Account: 'Payroll Liabilities', Debit: '', Credit: '1,850.00' },
        { Account: 'Deferred Revenue', Debit: '', Credit: '5,000.00' },
        { Account: 'Net Assets - Unrestricted', Debit: '', Credit: '181,130.25' },
        { Account: 'Net Assets - Restricted', Debit: '', Credit: '22,500.00' },
      ],
      summary: { Account: 'Total Balance Sheet', Debit: '188,981.25', Credit: '213,680.25' },
    },
    {
      accountName: 'Income & Expense',
      lines: [
        { Account: 'Donations - General', Debit: '', Credit: '1,325.00' },
        { Account: 'Donations - Restricted', Debit: '', Credit: '4,900.00' },
        { Account: 'Government Grants', Debit: '', Credit: '0.00' },
        { Account: 'Program Service Revenue', Debit: '', Credit: '0.00' },
        { Account: 'Program Services', Debit: '3,200.00', Credit: '' },
        { Account: 'Salaries & Wages', Debit: '17,000.00', Credit: '' },
        { Account: 'Payroll Taxes', Debit: '1,300.00', Credit: '' },
        { Account: 'Rent', Debit: '4,800.00', Credit: '' },
        { Account: 'Office Supplies', Debit: '450.00', Credit: '' },
        { Account: 'Platform Fees', Debit: '312.40', Credit: '' },
        { Account: 'Marketing & Outreach', Debit: '875.00', Credit: '' },
        { Account: 'Administrative', Debit: '625.60', Credit: '' },
        { Account: 'Insurance', Debit: '360.00', Credit: '' },
      ],
      summary: { Account: 'Total Income & Expense', Debit: '28,923.00', Credit: '6,225.00' },
    },
  ],
};
