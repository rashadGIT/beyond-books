import type { PlatformParser, NormalizedTransaction } from './types';

export const networkForGoodParser: PlatformParser = {
  platform: 'network_for_good',

  detect(headers: string[]): boolean {
    const h = headers.map(s => s.toLowerCase());
    return (
      h.some(c => c.includes('donor name') || c === 'donor') &&
      h.some(c => c.includes('designation') || c.includes('fund'))
    );
  },

  parse(rows: Record<string, string>[]): NormalizedTransaction[] {
    return rows
      .map((row, idx) => {
        const gross = parseFloat((row['Amount'] || row['Donation Amount'] || row['amount'] || '0').replace(/[$,]/g, '')) || 0;
        const fee = parseFloat((row['Processing Fee'] || row['Fee'] || row['fee'] || '0').replace(/[$,]/g, '')) || 0;
        const net = gross - fee;

        const firstName = row['Donor First Name'] || row['First Name'] || '';
        const lastName = row['Donor Last Name'] || row['Last Name'] || '';
        const donorName = row['Donor Name'] || row['Donor'] || `${firstName} ${lastName}`.trim() || 'Unknown';

        return {
          transactionId: row['Transaction ID'] || row['Confirmation #'] || row['Confirmation Number'] || `nfg-${idx}-${Date.now()}`,
          date: row['Donation Date'] || row['Date'] || new Date().toISOString().slice(0, 10),
          donorName,
          donorEmail: row['Email'] || row['Donor Email'] || '',
          grossAmount: gross,
          fee,
          netAmount: net,
          description: row['Designation'] || row['Fund'] || row['Campaign'] || 'Network for Good Donation',
          source: 'network_for_good',
        };
      })
      .filter(tx => tx.grossAmount > 0);
  },
};
