import type { PlatformParser, NormalizedTransaction } from './types';

export const kindfulParser: PlatformParser = {
  platform: 'kindful',

  detect(headers: string[]): boolean {
    const h = headers.map(s => s.toLowerCase());
    return (
      (h.some(c => c === 'contact' || c.includes('contact name')) || h.some(c => c.includes('contact id'))) &&
      (h.some(c => c.includes('campaign')) || h.some(c => c.includes('platform fee')))
    );
  },

  parse(rows: Record<string, string>[]): NormalizedTransaction[] {
    return rows
      .map((row, idx) => {
        const gross = parseFloat((row['Amount'] || row['Donation Amount'] || row['amount'] || '0').replace(/[$,]/g, '')) || 0;
        const fee = parseFloat((row['Platform Fee'] || row['Processing Fee'] || row['Fee'] || '0').replace(/[$,]/g, '')) || 0;
        const net = gross - fee;

        return {
          transactionId: row['Transaction ID'] || row['ID'] || `kindful-${idx}-${Date.now()}`,
          date: row['Date'] || row['Donation Date'] || row['Created At'] || new Date().toISOString().slice(0, 10),
          donorName: row['Contact'] || row['Contact Name'] || row['Name'] || 'Unknown',
          donorEmail: row['Email'] || row['Contact Email'] || '',
          grossAmount: gross,
          fee,
          netAmount: net,
          description: row['Campaign'] || row['Fund'] || row['Note'] || 'Kindful Donation',
          source: 'kindful',
        };
      })
      .filter(tx => tx.grossAmount > 0);
  },
};
