import { prisma } from './prisma';
import { FileService } from './fileService';
import { StandardizedTransaction } from './types';

export const ChatFileService = {
  // Process demo files from /demo-data directory
  processDemoFiles: async (userId = 'system') => {
    const results = await FileService.processDemoFiles();

    // Save each demo file to database
    const savedFiles = await Promise.all(
      results.map(async (result) => {
        const processedFile = await prisma.processedFile.create({
          data: {
            userId,
            filename: result.filename,
            source: result.source,
            fileSize: 0, // Demo files don't have size tracking
            transactionCount: result.count,
            totalAmount: result.total,
            transactions: {
              create: result.transactions.map((tx: StandardizedTransaction) => ({
                transactionId: tx.id,
                date: tx.date,
                source: tx.source,
                donorName: tx.donorName,
                donorEmail: tx.donorEmail,
                grossAmount: tx.grossAmount,
                fee: tx.fee,
                netAmount: tx.netAmount,
                description: tx.description,
                originalData: JSON.stringify(tx.originalData),
              })),
            },
          },
          include: {
            transactions: true,
          },
        });
        return processedFile;
      })
    );

    return savedFiles;
  },

  // Get all processed files with transaction summaries
  getAllFiles: async () => {
    return await prisma.processedFile.findMany({
      include: {
        transactions: true,
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });
  },

  // Group transactions by donor
  groupTransactionsByDonor: async (fileId?: string) => {
    const where = fileId ? { fileId } : {};
    const transactions = await prisma.donationTransaction.findMany({ where });

    const grouped = new Map<
      string,
      {
        name: string;
        email: string;
        total: number;
        count: number;
        transactions: any[];
      }
    >();

    transactions.forEach((tx) => {
      const key = `${tx.donorName}|${tx.donorEmail.toLowerCase()}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: tx.donorName,
          email: tx.donorEmail,
          total: 0,
          count: 0,
          transactions: [],
        });
      }
      const group = grouped.get(key)!;
      group.total += tx.grossAmount;
      group.count += 1;
      group.transactions.push(tx);
    });

    return Array.from(grouped.values());
  },

  // Get donation statistics
  getStatistics: async (fileId?: string) => {
    const where = fileId ? { fileId } : {};
    const transactions = await prisma.donationTransaction.findMany({ where });

    const total = transactions.reduce((sum, tx) => sum + tx.grossAmount, 0);
    const count = transactions.length;
    const average = count > 0 ? total / count : 0;
    const fees = transactions.reduce((sum, tx) => sum + tx.fee, 0);
    const net = transactions.reduce((sum, tx) => sum + tx.netAmount, 0);

    const uniqueDonors = new Set(
      transactions.map((tx) => `${tx.donorName}|${tx.donorEmail}`)
    ).size;

    return {
      totalDonations: total,
      donationCount: count,
      averageDonation: average,
      totalFees: fees,
      netAmount: net,
      uniqueDonors,
    };
  },
};
