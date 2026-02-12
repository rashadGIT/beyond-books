'use client';

import React, { useMemo, useState } from 'react';
import { StandardizedTransaction, BrandingConfig } from '@/lib/types';
import { Printer, ChevronLeft, Mail, Send, CheckCircle, Download } from 'lucide-react';
import Link from 'next/link';

interface DonorGroup {
  name: string;
  email: string;
  total: number;
  donations: StandardizedTransaction[];
}

const DEFAULT_BRANDING: BrandingConfig = {
  organizationName: 'Youth Revive Inc.',
  tagline: 'Building stronger communities together',
  taxId: '840-464680632',
  signerName: 'Brandie',
  signerTitle: 'Executive Director',
  primaryColor: '#2563eb',
};

// Helper to format dates (handles Excel serial numbers)
const formatDate = (val: any): string => {
  if (!val) return '';

  // If it's a number, it's an Excel serial date
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + val * 86400000);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  // If it's already a string, check if it looks like a date
  if (typeof val === 'string') {
    // If it's already formatted nicely (contains slashes or dashes), return as-is
    if (val.includes('/') || val.includes('-')) {
      return val;
    }
    // Try parsing as a date
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }
  }

  return val.toString();
};

export default function LettersPage() {
  const [viewMode, setViewMode] = useState<'summary' | 'individual'>('summary');
  const [transactions, setTransactions] = useState<StandardizedTransaction[]>([]);
  const [sentEmails, setSentEmails] = useState<Record<string, boolean>>({});
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [printingLetterId, setPrintingLetterId] = useState<string | null>(null);

  // Load data from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('last_processed_data');
    const savedBranding = localStorage.getItem('branding_config');

    if (saved) {
      setTransactions(JSON.parse(saved));
    }
    if (savedBranding) {
      setBranding(JSON.parse(savedBranding));
    }
  }, []);

  // Strict grouping: Same Name AND Same Email
  const donorGroups = useMemo(() => {
    const groups: Record<string, DonorGroup> = {};
    transactions.forEach(tx => {
      const name = tx.donorName.trim();
      const email = tx.donorEmail.trim().toLowerCase();
      // Composite key to ensure both name and email match for summing
      const key = `${name}|${email}`; 
      
      if (!groups[key]) {
        groups[key] = {
          name: tx.donorName,
          email: tx.donorEmail,
          total: 0,
          donations: []
        };
      }
      groups[key].total += tx.grossAmount;
      groups[key].donations.push(tx);
    });
    return Object.values(groups);
  }, [transactions]);

  const handlePrint = () => window.print();

  const handleSendEmail = (id: string, email: string) => {
    // Mocking email sending for POC
    console.log(`Sending email to ${email}...`);
    setSentEmails(prev => ({ ...prev, [id]: true }));
    alert(`Email sent successfully to ${email}!`);
  };

  const handlePrintSingle = (letterId: string) => {
    setPrintingLetterId(letterId);
    // Small delay to let state update before printing
    setTimeout(() => {
      window.print();
      setPrintingLetterId(null);
    }, 100);
  };

  if (transactions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-slate-500">
        <Mail className="w-12 h-12 mb-4 opacity-20" />
        <p className="mb-4">No donation data found to generate letters.</p>
        <Link href="/" className="text-blue-600 hover:underline flex items-center">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Upload
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto print:max-w-none">
        {/* Navigation / Controls - Hidden on Print */}
        <div className="flex justify-between items-center mb-8 print:hidden">
          <Link href="/" className="flex items-center text-slate-600 hover:text-blue-600 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Dashboard
          </Link>
          
          <div className="flex items-center space-x-4">
            <div className="bg-white border border-slate-200 rounded-lg p-1 flex">
              <button 
                onClick={() => setViewMode('summary')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Summary (Merged)
              </button>
              <button 
                onClick={() => setViewMode('individual')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'individual' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Individual
              </button>
            </div>
            <button 
              onClick={handlePrint}
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4 mr-2" /> Print All
            </button>
          </div>
        </div>

        {/* Letters Area */}
        <div className="space-y-8 print:space-y-0">
          {viewMode === 'summary' ? (
            donorGroups.map((group, idx) => {
              const letterId = `merged-${idx}`;
              const isHidden = printingLetterId && printingLetterId !== letterId;
              return (
                <div key={letterId} className={`relative group ${isHidden ? 'print:hidden' : ''}`}>
                  <div className="absolute right-8 top-24 print:hidden flex space-x-2">
                    {group.email ? (
                      <button
                        onClick={() => handleSendEmail(letterId, group.email)}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          sentEmails[letterId]
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {sentEmails[letterId] ? (
                          <><CheckCircle className="w-4 h-4 mr-1.5" /> Sent</>
                        ) : (
                          <><Send className="w-4 h-4 mr-1.5" /> Send via Email</>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePrintSingle(letterId)}
                        className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                      >
                        <Printer className="w-4 h-4 mr-1.5" /> Print Letter
                      </button>
                    )}
                  </div>
                  <LetterTemplate
                    donorName={group.name}
                    donorEmail={group.email}
                    totalAmount={group.total}
                    dateRange="Annual Summary 2026"
                    isSummary={true}
                    donations={group.donations}
                    branding={branding}
                  />
                </div>
              );
            })
          ) : (
            transactions.map((tx, idx) => {
              const letterId = `tx-${tx.id || idx}`;
              const isHidden = printingLetterId && printingLetterId !== letterId;
              return (
                <div key={letterId} className={`relative group ${isHidden ? 'print:hidden' : ''}`}>
                  <div className="absolute right-8 top-24 print:hidden flex space-x-2">
                    {tx.donorEmail ? (
                      <button
                        onClick={() => handleSendEmail(letterId, tx.donorEmail)}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          sentEmails[letterId]
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                      >
                        {sentEmails[letterId] ? (
                          <><CheckCircle className="w-4 h-4 mr-1.5" /> Sent</>
                        ) : (
                          <><Send className="w-4 h-4 mr-1.5" /> Send via Email</>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePrintSingle(letterId)}
                        className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
                      >
                        <Printer className="w-4 h-4 mr-1.5" /> Print Letter
                      </button>
                    )}
                  </div>
                  <LetterTemplate
                    donorName={tx.donorName}
                    donorEmail={tx.donorEmail}
                    totalAmount={tx.grossAmount}
                    dateRange={formatDate(tx.date)}
                    isSummary={false}
                    branding={branding}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function LetterTemplate({
  donorName,
  donorEmail,
  totalAmount,
  dateRange,
  isSummary,
  donations,
  branding
}: {
  donorName: string;
  donorEmail: string;
  totalAmount: number;
  dateRange: string;
  isSummary: boolean;
  donations?: StandardizedTransaction[];
  branding: BrandingConfig;
}) {
  return (
    <div className="bg-white p-12 shadow-sm border border-slate-200 min-h-[10.5in] flex flex-col print:shadow-none print:border-none print:m-0 print:break-after-page">
      {/* Letterhead */}
      <div className="flex justify-between items-start mb-12 border-b border-slate-100 pb-8">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-tight" style={{ color: branding.primaryColor }}>
            {branding.organizationName}
          </h2>
          <p className="text-slate-500 text-sm italic">{branding.tagline}</p>
        </div>
        <div className="text-right text-sm text-slate-400">
          <p className="font-medium text-slate-600">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <p>Official Tax Receipt</p>
        </div>
      </div>

      {/* Recipient */}
      <div className="mb-10 text-slate-800">
        <p className="font-semibold mb-1">To:</p>
        <p className="text-lg font-bold">{donorName || 'Valued Donor'}</p>
        <p className="text-slate-500">{donorEmail}</p>
      </div>

      {/* Body */}
      <div className="flex-grow text-slate-700 leading-relaxed space-y-6">
        <p>
          Dear {donorName.split(' ')[0] || 'Friend'},
        </p>
        <p>
          Thank you for your generous contribution to **{branding.organizationName}**. Your support allows us to
          continue our mission and impact the lives of those we serve.
        </p>

        <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 my-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Total Contribution</p>
              <p className="text-4xl font-black" style={{ color: branding.primaryColor }}>
                ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Contribution Date</p>
              <p className="text-xl font-semibold text-slate-700">{dateRange}</p>
            </div>
          </div>
        </div>

        {isSummary && donations && (
          <div className="mt-6 border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {donations.map((d, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-slate-500">{formatDate(d.date)}</td>
                    <td className="px-4 py-2 text-slate-700">{d.description}</td>
                    <td className="px-4 py-2 text-right font-semibold">${d.grossAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="pt-4">
          Please retain this letter for your tax records. No goods or services were provided by the 
          organization in return for the contributions mentioned above.
        </p>
      </div>

      {/* Footer / Signature */}
      <div className="mt-auto pt-12 border-t border-slate-100">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-slate-800">Sincerely,</p>
            <div className="mt-4">
              <p className="font-bold text-slate-900 text-lg">{branding.signerName}</p>
              <p className="text-slate-500 text-sm">{branding.signerTitle}</p>
              <p className="text-sm font-semibold" style={{ color: branding.primaryColor }}>
                {branding.organizationName}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-tighter">
              Tax-Exempt ID: {branding.taxId} | 501(c)(3) Certified
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}