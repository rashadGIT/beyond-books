import type { PlatformParser, NormalizedTransaction } from './types';

export const paypalParser: PlatformParser = {
  platform: 'paypal',

  detect(headers: string[]): boolean {
    const h = headers.map(s => s.toLowerCase());
    return (
      h.some(c => c.includes('transaction id')) &&
      h.some(c => c === 'gross' || c.includes('gross')) &&
      h.some(c => c === 'fee' || c.includes('fee')) &&
      h.some(c => c === 'name' || c === 'from name' || c.includes('name'))
    );
  },

  parse(rows: Record<string, string>[]): NormalizedTransaction[] {
    return rows
      .filter(row => {
        const type = (row['Type'] || row['type'] || '').toLowerCase();
        // Skip refunds, reversals, transfers
        return !type.includes('refund') && !type.includes('reversal') && !type.includes('transfer');
      })
      .map(row => {
        const gross = parseFloat((row['Gross'] || row['gross'] || '0').replace(/[$,]/g, '')) || 0;
        const fee = Math.abs(parseFloat((row['Fee'] || row['fee'] || '0').replace(/[$,]/g, '')) || 0);
        const net = parseFloat((row['Net'] || row['net'] || '0').replace(/[$,]/g, '')) || gross - fee;
        return {
          transactionId: row['Transaction ID'] || row['transaction id'] || `pp-${Date.now()}-${Math.random()}`,
          date: row['Date'] || row['date'] || new Date().toISOString().slice(0, 10),
          donorName: row['Name'] || row['From Name'] || row['name'] || 'Unknown',
          donorEmail: row['From Email Address'] || row['Email'] || row['email'] || '',
          grossAmount: gross,
          fee,
          netAmount: net,
          description: row['Subject'] || row['Item Title'] || 'PayPal Donation',
          source: 'paypal',
        };
      })
      .filter(tx => tx.grossAmount > 0);
  },
};
