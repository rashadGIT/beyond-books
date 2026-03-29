import {
  parseCurrency,
  parsePercent,
  parseDate,
  processData,
  mergeCustomerData,
} from '../parser';
import type { StandardizedTransaction } from '../types';

describe('parseCurrency', () => {
  it('parses a formatted dollar string', () => {
    expect(parseCurrency('$1,234.56')).toBe(1234.56);
  });

  it('returns a negative number as-is', () => {
    expect(parseCurrency(-500)).toBe(-500);
  });

  it('returns 0 for empty string', () => {
    expect(parseCurrency('')).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(parseCurrency(undefined)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(parseCurrency(null)).toBe(0);
  });

  it('parses a plain number string', () => {
    expect(parseCurrency('99.99')).toBe(99.99);
  });

  it('strips commas and dollar signs', () => {
    expect(parseCurrency('$10,000.00')).toBe(10000);
  });

  it('returns a number directly without modification', () => {
    expect(parseCurrency(42.5)).toBe(42.5);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseCurrency('abc')).toBe(0);
  });
});

describe('parsePercent', () => {
  it('strips percent sign and returns number', () => {
    expect(parsePercent('12.5%')).toBe(12.5);
  });

  it('returns a number directly', () => {
    expect(parsePercent(25)).toBe(25);
  });

  it('returns 0 for empty string', () => {
    expect(parsePercent('')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(parsePercent(null)).toBe(0);
  });

  it('strips whitespace', () => {
    expect(parsePercent('  50%  ')).toBe(50);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parsePercent('N/A')).toBe(0);
  });
});

describe('parseDate', () => {
  it('returns empty string for empty input', () => {
    expect(parseDate('')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(parseDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(parseDate(undefined)).toBe('');
  });

  it('converts an Excel serial date (integer) to a formatted date string', () => {
    // Excel serial 45000 maps to a real calendar date
    const result = parseDate(45000);
    // Should return a string in MM/DD/YYYY format
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('formats an ISO date string into a MM/DD/YYYY pattern', () => {
    // Use a date string with explicit time to avoid timezone off-by-one shifts
    const result = parseDate('2024-01-15T12:00:00');
    // toLocaleDateString with en-US locale gives MM/DD/YYYY
    expect(result).toMatch(/01\/15\/2024/);
  });

  it('returns a non-date string as-is', () => {
    expect(parseDate('not-a-date')).toBe('not-a-date');
  });

  it('converts a Date object by calling toString()', () => {
    const date = new Date('2024-06-01');
    const result = parseDate(date);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('processData — source detection', () => {
  it('detects PayPal source from headers', () => {
    const headers = ['Transaction ID', 'Date', 'Name', 'From Email Address', 'Gross', 'Fee', 'Net', 'Item Title', 'Subject'];
    const data = [
      {
        'Transaction ID': 'TX001',
        'Date': '2024-01-01',
        'Name': 'Jane Doe',
        'From Email Address': 'jane@example.com',
        'Gross': '$100.00',
        'Fee': '-$2.90',
        'Net': '$97.10',
        'Item Title': 'Donation',
        'Subject': '',
      },
    ];

    const result = processData(data, headers);
    expect(result.source).toBe('PayPal');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].donorName).toBe('Jane Doe');
    expect(result.transactions[0].grossAmount).toBe(100);
    expect(result.transactions[0].fee).toBe(-2.90);
    expect(result.transactions[0].netAmount).toBe(97.10);
  });

  it('detects Stripe source from headers', () => {
    const headers = ['id', 'Customer Description', 'Customer Email', 'Amount', 'Fee', 'Created date (UTC)', 'Description'];
    const data = [
      {
        id: 'ch_001',
        'Customer Description': 'Bob Smith',
        'Customer Email': 'bob@example.com',
        'Amount': '200',
        'Fee': '6',
        'Created date (UTC)': '2024-02-01',
        'Description': 'Annual gift',
      },
    ];

    const result = processData(data, headers);
    expect(result.source).toBe('Stripe / Unified Payments');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].donorName).toBe('Bob Smith');
    expect(result.transactions[0].grossAmount).toBe(200);
    expect(result.transactions[0].netAmount).toBe(194);
  });

  it('detects QuickBooks Sales Summary source', () => {
    const headers = ['Customer', 'Total'];
    const data = [
      { Customer: 'Alice Corp', Total: '$500.00' },
    ];

    const result = processData(data, headers);
    expect(result.source).toBe('QuickBooks Sales Summary');
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].donorName).toBe('Alice Corp');
    expect(result.transactions[0].grossAmount).toBe(500);
  });

  it('returns Unknown source when headers do not match any pattern', () => {
    const headers = ['col1', 'col2'];
    const data = [{ col1: 'a', col2: 'b' }];

    const result = processData(data, headers);
    expect(result.source).toBe('Unknown');
    expect(result.transactions).toHaveLength(0);
  });

  it('detects Communities Foundation source', () => {
    const headers = ['Tracking #', 'Donor First Name', 'Donor Last Name', 'Date', 'Email', 'Amount', 'Transaction Fee Cost', 'Net Amount', 'Giving Event Name'];
    const data = [
      {
        'Tracking #': 'CFT001',
        'Donor First Name': 'Carol',
        'Donor Last Name': 'Williams',
        'Date': '2024-03-01',
        'Email': 'carol@example.com',
        'Amount': '$300.00',
        'Transaction Fee Cost': '$5.00',
        'Net Amount': '$295.00',
        'Giving Event Name': 'Spring Campaign',
      },
    ];

    const result = processData(data, headers);
    expect(result.source).toBe('Communities Foundation (Disbursement)');
    expect(result.transactions[0].donorName).toBe('Carol Williams');
    expect(result.transactions[0].grossAmount).toBe(300);
  });

  it('returns empty transactions for QuickBooks Customer List headers', () => {
    const headers = ['Customer Contact List', 'Email'];
    const data = [{ 'Customer Contact List': 'John', Email: 'john@example.com' }];

    const result = processData(data, headers);
    expect(result.source).toBe('QuickBooks Customer List');
    expect(result.transactions).toHaveLength(0);
  });

  it('skips QB Sales Summary rows where Customer equals "Customer"', () => {
    const headers = ['Customer', 'Total'];
    const data = [
      { Customer: 'Customer', Total: 'Total' }, // header row
      { Customer: 'Real Donor', Total: '$150.00' },
    ];

    const result = processData(data, headers);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].donorName).toBe('Real Donor');
  });
});

describe('mergeCustomerData', () => {
  const baseTransaction: StandardizedTransaction = {
    id: 'tx-1',
    date: '01/01/2024',
    source: 'PayPal',
    donorName: 'Alice Smith',
    donorEmail: '',
    grossAmount: 100,
    fee: 0,
    netAmount: 100,
    description: 'Donation',
    originalData: {},
  };

  it('fills in email from matching customer contact', () => {
    const customers = [{ name: 'Alice Smith', email: 'alice@example.com', phone: '', billAddress: '', shipAddress: '' }];
    const [merged] = mergeCustomerData([baseTransaction], customers);
    expect(merged.donorEmail).toBe('alice@example.com');
  });

  it('does a case-insensitive name match', () => {
    const customers = [{ name: 'alice smith', email: 'alice@example.com', phone: '', billAddress: '', shipAddress: '' }];
    const [merged] = mergeCustomerData([baseTransaction], customers);
    expect(merged.donorEmail).toBe('alice@example.com');
  });

  it('leaves email unchanged when no matching customer found', () => {
    const [merged] = mergeCustomerData([baseTransaction], []);
    expect(merged.donorEmail).toBe('');
  });

  it('does not overwrite an existing email with an empty customer email', () => {
    const txWithEmail = { ...baseTransaction, donorEmail: 'original@example.com' };
    const customers = [{ name: 'Alice Smith', email: '', phone: '', billAddress: '', shipAddress: '' }];
    const [merged] = mergeCustomerData([txWithEmail], customers);
    // empty customer email => original kept
    expect(merged.donorEmail).toBe('original@example.com');
  });
});
