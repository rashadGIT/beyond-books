export interface ChatIntent {
  type: 'process_file' | 'process_demo' | 'show_stats' | 'list_donors' | 'send_letter' | 'send_bulk_letters' | 'help' | 'unknown';
  params?: {
    donorName?: string;
    fileId?: string;
    all?: boolean;
  };
}

export class ChatCommandParser {
  static parseIntent(userMessage: string): ChatIntent {
    const msg = userMessage.toLowerCase().trim();

    // Process demo files
    if (msg.includes('process') && (msg.includes('demo') || msg.includes('sample'))) {
      return { type: 'process_demo' };
    }

    // Show statistics
    if (msg.includes('stat') || msg.includes('total') || msg.includes('summary')) {
      return { type: 'show_stats' };
    }

    // List donors
    if (msg.includes('list') && msg.includes('donor')) {
      return { type: 'list_donors' };
    }

    // Send letter to specific donor
    const sendLetterMatch = msg.match(/send letter to (.+)/i);
    if (sendLetterMatch) {
      return {
        type: 'send_letter',
        params: { donorName: sendLetterMatch[1].trim() },
      };
    }

    // Send bulk letters
    if (
      (msg.includes('send') && msg.includes('all')) ||
      msg.includes('bulk') ||
      msg.includes('send letters')
    ) {
      return { type: 'send_bulk_letters', params: { all: true } };
    }

    // Help
    if (msg.includes('help') || msg.includes('what can you do')) {
      return { type: 'help' };
    }

    return { type: 'unknown' };
  }

  static formatResponse(intent: ChatIntent, data?: any): string {
    switch (intent.type) {
      case 'show_stats':
        return this.formatStats(data);
      case 'list_donors':
        return this.formatDonorList(data);
      case 'send_letter':
        return this.formatLetterSent(data);
      case 'send_bulk_letters':
        return this.formatBulkSent(data);
      case 'help':
        return this.formatHelp();
      case 'process_demo':
        return this.formatDemoProcessed(data);
      default:
        return "Query processed. Available commands: 'process demo files', 'show stats', 'list donors', 'send letter to [name]', 'send all letters', 'help'.";
    }
  }

  private static formatStats(stats: any): string {
    return `
**Donation Statistics**

| Metric | Value |
|--------|-------|
| Total Donations | $${stats.totalDonations.toLocaleString(undefined, { minimumFractionDigits: 2 })} |
| Number of Donations | ${stats.donationCount} |
| Average Donation | $${stats.averageDonation.toFixed(2)} |
| Total Fees | $${stats.totalFees.toFixed(2)} |
| Net Amount | $${stats.netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} |
| Unique Donors | ${stats.uniqueDonors} |

System Status: All data synchronized. Ready for letter generation.
    `.trim();
  }

  private static formatDonorList(donors: any[]): string {
    const header = `**Donor Database - ${donors.length} Records**\n\n`;
    const table = `| Donor Name | Email | Donations | Total Amount |\n|------------|-------|-----------|-------------|\n`;
    const rows = donors
      .map(
        (d) =>
          `| ${d.name} | ${d.email || 'N/A'} | ${d.count} | $${d.total.toFixed(2)} |`
      )
      .join('\n');
    return header + table + rows;
  }

  private static formatLetterSent(result: any): string {
    if (result.success) {
      return `Letter successfully generated and sent to **${result.donorName}** (${result.email}).\n\nLetter ID: ${result.letterId}\nTotal Amount: $${result.amount.toFixed(2)}\n\nStatus: Email queued for delivery via N8N integration.`;
    }
    return `Failed to send letter: ${result.error}`;
  }

  private static formatBulkSent(result: any): string {
    return `Bulk letter generation complete.\n\n**Summary:**\n- Letters Generated: ${result.count}\n- Total Recipients: ${result.recipients}\n- Failed: ${result.failed || 0}\n\nAll letters queued for N8N email delivery.`;
  }

  private static formatHelp(): string {
    return `
**Available Commands:**

1. **Process Files**
   - "process demo files" - Process all demo CSV files
   - Attach a file via paperclip icon to upload and process

2. **View Data**
   - "show stats" - View donation statistics
   - "list donors" - Show all donors with totals

3. **Generate Letters**
   - "send letter to [donor name]" - Generate and send letter to specific donor
   - "send all letters" - Bulk generate letters for all donors

4. **Help**
   - "help" - Show this message

System Ready. Awaiting instructions.
    `.trim();
  }

  private static formatDemoProcessed(result: any): string {
    return `Demo files processed successfully.\n\n**Files Processed:**\n${result
      .map((f: any) => `- ${f.filename}: ${f.transactionCount} transactions ($${f.totalAmount.toFixed(2)})`)
      .join('\n')}\n\nReady for letter generation.`;
  }
}
