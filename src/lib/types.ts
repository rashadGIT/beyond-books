export interface StandardizedTransaction {
  id: string;
  date: string;
  source: string; // e.g., 'PayPal', 'Communities Foundation', 'Stripe'
  donorName: string;
  donorEmail: string;
  grossAmount: number;
  fee: number;
  netAmount: number;
  description: string;
  originalData: any;
}

export type MappingResult = {
  transactions: StandardizedTransaction[];
  source: string;
  headers: string[];
};

export interface CustomerContact {
  name: string;
  email: string;
  phone: string;
  billAddress: string;
  shipAddress: string;
}

export interface BrandingConfig {
  organizationName: string;
  tagline: string;
  taxId: string;
  logoUrl?: string;
  signerName: string;
  signerTitle: string;
  primaryColor: string;
  letterDate?: string;
}
