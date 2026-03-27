export interface NormalizedTransaction {
  transactionId: string;
  date: string;
  donorName: string;
  donorEmail: string;
  grossAmount: number;
  fee: number;
  netAmount: number;
  description: string;
  source: string;
}

export interface PlatformParser {
  platform: string;
  detect(headers: string[]): boolean;
  parse(rows: Record<string, string>[]): NormalizedTransaction[];
}
