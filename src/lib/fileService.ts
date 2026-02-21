import fs from 'fs/promises';
import path from 'path';
import { processCSV } from './parser';

export const FileService = {
  // Read and parse all files starting with "Demo_" in demo-data/
  processDemoFiles: async () => {
    const demoDir = path.join(process.cwd(), 'demo-data');
    const files = await fs.readdir(demoDir);
    const demoFiles = files.filter(f => f.startsWith('Demo_') && f.endsWith('.csv'));

    const results = await Promise.all(demoFiles.map(async (filename) => {
      const filePath = path.join(demoDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = processCSV(content);
      return {
        filename,
        source: parsed.source,
        count: parsed.transactions.length,
        total: parsed.transactions.reduce((sum, tx) => sum + tx.grossAmount, 0),
        transactions: parsed.transactions // Return the actual list
      };
    }));

    return results;
  }
};