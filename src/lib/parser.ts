import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { StandardizedTransaction, MappingResult, CustomerContact } from './types';

export const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/[$,\s]/g, '');
  return parseFloat(cleaned) || 0;
};

export const parsePercent = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = val.toString().replace(/[%\s]/g, '');
  return parseFloat(cleaned) || 0;
};

export const parseDate = (val: any): string => {
  if (!val) return '';

  // If it's a number, it's likely an Excel serial date
  if (typeof val === 'number') {
    // Excel epoch is 1/1/1900, but JavaScript is 1/1/1970
    // Excel serial dates count days from 1/1/1900
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899 (Excel quirk)
    const date = new Date(excelEpoch.getTime() + val * 86400000); // 86400000 ms per day
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  // If it's already a string date, try to parse and format it
  if (typeof val === 'string') {
    // Try parsing as a date
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }
    // If it's already formatted nicely, return as-is
    return val;
  }

  return val.toString();
};

// Process Excel files (.xlsx, .xls)
export const processExcel = (file: File): Promise<MappingResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // Find the actual header row (skip title rows)
        let headerRowIndex = 0;
        let headers = jsonData[0] as string[];

        // For Sales by Customer Summary, find the row with "Customer" and "Total"
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          const row = jsonData[i] as any[];
          if (row.includes('Customer') && row.includes('Total')) {
            headerRowIndex = i;
            headers = row;
            break;
          }
        }

        // Convert to CSV-like format for processing
        const rows = jsonData.slice(headerRowIndex + 1) as any[][];
        const csvData = rows.map(row => {
          const obj: any = {};
          headers.forEach((header, i) => {
            obj[header] = row[i];
          });
          return obj;
        }).filter(obj => Object.values(obj).some(v => v !== null && v !== undefined));

        const result = processData(csvData, headers);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Main data processing logic (used by both CSV and Excel)
export const processData = (data: any[], headers: string[]): MappingResult => {
  let source = 'Unknown';
  const transactions: StandardizedTransaction[] = [];

  // Detect Source
  if (headers.includes('Customer Contact List') || headers.includes('Customer full name')) {
    source = 'QuickBooks Customer List';
    // This is metadata, not transaction data
    // We'll handle this differently in the UI
    return { transactions: [], source, headers };
  } else if (headers.includes('Sales by Customer Summary') || (headers.includes('Customer') && headers.includes('Total'))) {
    source = 'QuickBooks Sales Summary';
    // Parse sales summary format
    data.forEach((row, i) => {
      const customer = row['Customer'] || row['Customer full name'];
      const total = row['Total'];

      if (customer && total && customer !== 'Customer') { // Skip header row
        transactions.push({
          id: `qb-${i}`,
          date: parseDate(new Date()),
          source,
          donorName: customer,
          donorEmail: '', // Will be filled from Customer List
          grossAmount: parseCurrency(total),
          fee: 0,
          netAmount: parseCurrency(total),
          description: 'Annual Donation',
          originalData: row,
        });
      }
    });
  } else if (headers.includes('Tracking #') && headers.includes('Donor First Name')) {
    source = 'Communities Foundation (Disbursement)';
    (data as any[]).forEach((row, i) => {
      transactions.push({
        id: row['Tracking #'] || `cft-${i}`,
        date: parseDate(row['Date']),
        source,
        donorName: `${row['Donor First Name']} ${row['Donor Last Name']}`.trim(),
        donorEmail: row['Email'] || '',
        grossAmount: parseCurrency(row['Amount']),
        fee: parseCurrency(row['Transaction Fee Cost']),
        netAmount: parseCurrency(row['Net Amount']),
        description: row['Giving Event Name'] || 'Donation',
        originalData: row,
      });
    });
  } else if (headers.includes('Transaction ID') && headers.includes('Gross')) {
    source = 'PayPal';
    (data as any[]).forEach((row, i) => {
      transactions.push({
        id: row['Transaction ID'] || `pp-${i}`,
        date: parseDate(row['Date']),
        source,
        donorName: row['Name'] || '',
        donorEmail: row['From Email Address'] || '',
        grossAmount: parseCurrency(row['Gross']),
        fee: parseCurrency(row['Fee']),
        netAmount: parseCurrency(row['Net']),
        description: row['Item Title'] || row['Subject'] || 'PayPal Transaction',
        originalData: row,
      });
    });
  } else if (headers.includes('id') && headers.includes('Customer Description')) {
    source = 'Stripe / Unified Payments';
    (data as any[]).forEach((row, i) => {
      const gross = parseCurrency(row['Amount']);
      const fee = parseCurrency(row['Fee']);
      transactions.push({
        id: row['id'] || `str-${i}`,
        date: parseDate(row['Created date (UTC)']),
        source,
        donorName: row['Customer Description'] || '',
        donorEmail: row['Customer Email'] || '',
        grossAmount: gross,
        fee: fee,
        netAmount: gross - fee, // Calculate net if not provided
        description: row['Description'] || 'Payment',
        originalData: row,
      });
    });
  }

  return { transactions, source, headers };
};

export const processCSV = (csvContent: string): MappingResult => {
  const { data, meta } = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = meta.fields || [];
  return processData(data as any[], headers);
};

// Parse QuickBooks Customer Contact List
export const parseCustomerList = (file: File): Promise<CustomerContact[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        const customers: CustomerContact[] = [];

        // Find the header row (contains "Customer full name")
        let headerRowIndex = -1;
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (row.some(cell => cell === 'Customer full name')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          reject(new Error('Could not find Customer full name header'));
          return;
        }

        const headers = jsonData[headerRowIndex] as string[];
        const nameIdx = headers.indexOf('Customer full name');
        const phoneIdx = headers.findIndex(h => h && h.toLowerCase().includes('phone'));
        const emailIdx = headers.indexOf('Email');
        const billAddrIdx = headers.indexOf('Bill address');
        const shipAddrIdx = headers.indexOf('Ship address');

        // Parse data rows
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          const name = row[nameIdx];

          if (name && typeof name === 'string' && name.trim()) {
            customers.push({
              name: name.trim(),
              email: row[emailIdx] || '',
              phone: row[phoneIdx] || '',
              billAddress: row[billAddrIdx] || '',
              shipAddress: row[shipAddrIdx] || '',
            });
          }
        }

        resolve(customers);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Merge customer contacts with transactions
export const mergeCustomerData = (
  transactions: StandardizedTransaction[],
  customers: CustomerContact[]
): StandardizedTransaction[] => {
  return transactions.map(tx => {
    // Find matching customer by name
    const customer = customers.find(c =>
      c.name.toLowerCase() === tx.donorName.toLowerCase()
    );

    if (customer) {
      return {
        ...tx,
        donorEmail: customer.email || tx.donorEmail,
        originalData: {
          ...tx.originalData,
          customerContact: customer,
        },
      };
    }

    return tx;
  });
};
