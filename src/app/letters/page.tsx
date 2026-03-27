'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StandardizedTransaction, BrandingConfig } from '@/lib/types';
import { Printer, Mail, Send, CheckCircle, RefreshCw, AlertTriangle, X, Upload } from 'lucide-react';
import Link from 'next/link';
import { AppNav } from '@/components/AppNav';

interface DonorGroup {
  name: string;
  email: string;
  total: number;
  donations: StandardizedTransaction[];
}

interface EmailLog {
  id: string;
  recipient: string;
  recipientName: string | null;
  subject: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  organizationName: 'Your Organization',
  tagline: 'Building stronger communities together',
  taxId: 'XX-XXXXXXX',
  signerName: 'Your Name',
  signerTitle: 'Executive Director',
  primaryColor: '#2563eb',
};

const formatDate = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + val * 86400000);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }
  if (typeof val === 'string') {
    if (val.includes('/') || val.includes('-')) return val;
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }
  return val.toString();
};

function mapQbReceiptToTransaction(r: any): StandardizedTransaction {
  const lines: any[] = r.Line ?? [];
  const description = lines.find((l: any) => l.DetailType === 'SalesItemLineDetail')
    ?.Description ?? r.CustomerMemo?.value ?? 'Donation';
  return {
    id: r.Id,
    date: r.TxnDate,
    source: 'QuickBooks',
    donorName: r.CustomerRef?.name ?? 'Unknown Donor',
    donorEmail: r.BillEmail?.Address ?? '',
    grossAmount: parseFloat(r.TotalAmt ?? '0'),
    fee: 0,
    netAmount: parseFloat(r.TotalAmt ?? '0'),
    description,
    originalData: r,
  };
}

export default function LettersPage() {
  const [viewMode, setViewMode] = useState<'summary' | 'individual' | 'history'>('summary');
  const [transactions, setTransactions] = useState<StandardizedTransaction[]>([]);
  const [sendingEmails, setSendingEmails] = useState<Record<string, boolean>>({});
  const [sentEmails, setSentEmails] = useState<Record<string, boolean>>({});
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [printingLetterId, setPrintingLetterId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'upload' | 'quickbooks'>('upload');
  const [qbStart, setQbStart] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [qbEnd, setQbEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [qbLoading, setQbLoading] = useState(false);
  const [qbError, setQbError] = useState('');

  // Email config
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  // Bulk send state
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ sent: number; total: number } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: { name: string; email: string; error: string }[] } | null>(null);
  const [showBulkFailures, setShowBulkFailures] = useState(false);

  // History
  const [history, setHistory] = useState<EmailLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const parsed: StandardizedTransaction[] = lines.slice(1).map((line, idx) => {
        // Handle quoted fields with commas inside
        const cols: string[] = [];
        let cur = '', inQ = false;
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; }
          else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        cols.push(cur.trim());
        const get = (keys: string[]) => {
          for (const k of keys) {
            const i = headers.findIndex(h => h.includes(k));
            if (i !== -1) return cols[i]?.replace(/^"|"$/g, '') ?? '';
          }
          return '';
        };
        const gross = parseFloat(get(['gross', 'amount', 'total', 'donation'])) || 0;
        const fee = parseFloat(get(['fee'])) || 0;
        return {
          id: get(['id', 'txn', 'transaction']) || `row-${idx}`,
          date: get(['date']),
          source: file.name,
          donorName: get(['name', 'donor', 'customer', 'full']),
          donorEmail: get(['email']),
          grossAmount: gross,
          fee,
          netAmount: parseFloat(get(['net'])) || gross - fee,
          description: get(['description', 'memo', 'note', 'fund', 'purpose']),
          originalData: cols,
        };
      }).filter(t => t.donorName || t.grossAmount);
      localStorage.setItem('last_processed_data', JSON.stringify(parsed));
      setTransactions(parsed);
      setDataSource('upload');
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  };

  const loadFromQb = async () => {
    setQbLoading(true);
    setQbError('');
    try {
      const res = await fetch(`/api/ledger/sales-receipts?start=${qbStart}&end=${qbEnd}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      const receipts: any[] = data.receipts ?? [];
      setTransactions(receipts.map(mapQbReceiptToTransaction));
    } catch (e: any) {
      setQbError(e.message);
    }
    setQbLoading(false);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/letters/history');
      const data = await res.json();
      setHistory(data.logs ?? []);
    } catch {}
    setHistoryLoading(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('last_processed_data');
    if (saved) setTransactions(JSON.parse(saved));

    fetch('/api/settings/branding')
      .then(r => r.json())
      .then(async (apiData) => {
        const localRaw = localStorage.getItem('branding_config');
        if (localRaw && !apiData.id) {
          try {
            const local = JSON.parse(localRaw);
            await fetch('/api/settings/branding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orgName: local.organizationName,
                tagLine: local.tagline,
                taxId: local.taxId,
                signerName: local.signerName,
                signerTitle: local.signerTitle,
                logoUrl: local.logoUrl,
                primaryColor: local.primaryColor,
              }),
            });
            localStorage.removeItem('branding_config');
          } catch {}
        }
        setBranding({
          organizationName: apiData.orgName ?? DEFAULT_BRANDING.organizationName,
          tagline: apiData.tagLine ?? DEFAULT_BRANDING.tagline,
          taxId: apiData.taxId ?? DEFAULT_BRANDING.taxId,
          signerName: apiData.signerName ?? DEFAULT_BRANDING.signerName,
          signerTitle: apiData.signerTitle ?? DEFAULT_BRANDING.signerTitle,
          logoUrl: apiData.logoUrl ?? undefined,
          primaryColor: apiData.primaryColor ?? DEFAULT_BRANDING.primaryColor,
        });
      })
      .catch(() => {});

    fetch('/api/settings/email')
      .then(r => r.json())
      .then(data => setEmailConfigured(data.configured))
      .catch(() => setEmailConfigured(false));
  }, []);

  useEffect(() => {
    if (viewMode === 'history') loadHistory();
  }, [viewMode]);

  const donorGroups = useMemo(() => {
    const groups: Record<string, DonorGroup> = {};
    transactions.forEach(tx => {
      const name = tx.donorName.trim();
      const email = tx.donorEmail.trim().toLowerCase();
      const key = `${name}|${email}`;
      if (!groups[key]) {
        groups[key] = { name: tx.donorName, email: tx.donorEmail, total: 0, donations: [] };
      }
      groups[key].total += tx.grossAmount;
      groups[key].donations.push(tx);
    });
    return Object.values(groups);
  }, [transactions]);

  const handlePrint = () => window.print();

  const handleSendEmail = async (letterId: string, group: DonorGroup) => {
    setSendingEmails(p => ({ ...p, [letterId]: true }));
    setSendErrors(p => { const n = { ...p }; delete n[letterId]; return n; });
    try {
      const res = await fetch('/api/letters/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: group.name,
          donorEmail: group.email,
          totalAmount: group.total,
          dateRange: 'Annual Summary 2026',
          orgName: branding.organizationName,
          taxId: branding.taxId,
          donations: group.donations.map(d => ({
            date: formatDate(d.date),
            description: d.description,
            amount: d.grossAmount,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSentEmails(p => ({ ...p, [letterId]: true }));
      } else {
        setSendErrors(p => ({ ...p, [letterId]: data.error ?? 'Failed to send' }));
      }
    } catch (e: any) {
      setSendErrors(p => ({ ...p, [letterId]: e.message ?? 'Network error' }));
    }
    setSendingEmails(p => ({ ...p, [letterId]: false }));
  };

  const handleBulkSend = async () => {
    setBulkSending(true);
    setBulkResult(null);
    setBulkProgress({ sent: 0, total: donorGroups.filter(g => g.email).length });
    try {
      const donors = donorGroups
        .filter(g => g.email)
        .map(g => ({
          donorName: g.name,
          donorEmail: g.email,
          totalAmount: g.total,
          dateRange: 'Annual Summary 2026',
          orgName: branding.organizationName,
          taxId: branding.taxId,
          donations: g.donations.map(d => ({
            date: formatDate(d.date),
            description: d.description,
            amount: d.grossAmount,
          })),
        }));

      const res = await fetch('/api/letters/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk', donors }),
      });
      const data = await res.json();
      setBulkResult({ sent: data.sent ?? 0, failed: data.failed ?? [] });
    } catch (e: any) {
      setBulkResult({ sent: 0, failed: [{ name: 'All', email: '', error: e.message }] });
    }
    setBulkProgress(null);
    setBulkSending(false);
  };

  const handlePrintSingle = (letterId: string) => {
    setPrintingLetterId(letterId);
    setTimeout(() => { window.print(); setPrintingLetterId(null); }, 100);
  };

  const donorsWithEmail = donorGroups.filter(g => g.email).length;

  return (
    <div className="min-h-screen bg-[#020617] print:bg-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 print:hidden">
        <div className="flex items-center gap-4 flex-wrap">
          <Mail className="w-5 h-5 text-sky-400" />
          <h1 className="text-lg font-bold text-white">Donation Letters</h1>
          {transactions.length > 0 && (
            <span className="text-slate-600 text-xs">{donorGroups.length} donors · {transactions.length} transactions</span>
          )}

          {/* View toggle */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button onClick={() => setViewMode('summary')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'summary' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Summary</button>
            <button onClick={() => setViewMode('individual')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'individual' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Individual</button>
            <button onClick={() => setViewMode('history')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'history' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>History</button>
          </div>

          {transactions.length > 0 && viewMode !== 'history' && (
            <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-all border border-slate-700">
              <Printer className="w-3.5 h-3.5" /> Print All
            </button>
          )}

          {/* Bulk Send All */}
          {viewMode === 'summary' && transactions.length > 0 && emailConfigured && donorsWithEmail > 0 && (
            <button
              onClick={handleBulkSend}
              disabled={bulkSending}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            >
              {bulkSending
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> {bulkProgress ? `Sending ${bulkProgress.sent}/${bulkProgress.total}...` : 'Preparing...'}</>
                : <><Send className="w-3.5 h-3.5" /> Send All ({donorsWithEmail})</>
              }
            </button>
          )}

          <div className="ml-auto"><AppNav /></div>
        </div>

        {/* Bulk result banner */}
        {bulkResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-xl px-4 py-2.5 text-xs ${bulkResult.failed.length === 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'}`}>
            <span className="flex-1">
              {bulkResult.sent} sent{bulkResult.failed.length > 0 ? ` · ${bulkResult.failed.length} failed` : ''}
              {bulkResult.failed.length > 0 && (
                <button onClick={() => setShowBulkFailures(v => !v)} className="ml-2 underline">{showBulkFailures ? 'hide details' : 'show details'}</button>
              )}
            </span>
            <button onClick={() => setBulkResult(null)}><X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" /></button>
          </div>
        )}
        {showBulkFailures && bulkResult?.failed.map((f, i) => (
          <div key={i} className="mt-1 px-4 py-1 text-xs text-red-400 bg-red-500/5 rounded-lg">
            {f.name} ({f.email || 'no email'}): {f.error}
          </div>
        ))}

        {/* Email not configured banner */}
        {emailConfigured === false && (
          <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Email not configured. <Link href="/settings" className="underline font-medium">Set up email in Settings</Link> to send letters.</span>
          </div>
        )}

        {/* Data source row */}
        {viewMode !== 'history' && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-500">Data source:</span>
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                onClick={() => { setDataSource('upload'); const saved = localStorage.getItem('last_processed_data'); setTransactions(saved ? JSON.parse(saved) : []); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dataSource === 'upload' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Uploaded File
              </button>
              <button
                onClick={() => { setDataSource('quickbooks'); setTransactions([]); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${dataSource === 'quickbooks' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                QuickBooks
              </button>
            </div>

            {dataSource === 'upload' && (
              <>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg transition-all"
                >
                  <Upload className="w-3 h-3" /> Upload CSV
                </button>
              </>
            )}

            {dataSource === 'quickbooks' && (
              <div className="flex items-center gap-2">
                <input type="date" value={qbStart} onChange={e => setQbStart(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500" />
                <span className="text-slate-600 text-xs">to</span>
                <input type="date" value={qbEnd} onChange={e => setQbEnd(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500" />
                <button onClick={loadFromQb} disabled={qbLoading}
                  className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all">
                  <RefreshCw className={`w-3 h-3 ${qbLoading ? 'animate-spin' : ''}`} />
                  {qbLoading ? 'Loading...' : 'Load'}
                </button>
                {qbError && <span className="text-red-400 text-xs">{qbError}</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* History tab */}
      {viewMode === 'history' && (
        <div className="max-w-4xl mx-auto px-6 py-6">
          {historyLoading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-12 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Mail className="w-12 h-12 mb-4 text-slate-700" />
              <p className="text-slate-400 font-medium mb-1">No emails sent yet</p>
              <p className="text-slate-600 text-sm">Emails you send from the Summary tab will appear here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide">Donor</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide">Sent At</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map(log => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 text-slate-200">{log.recipientName ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{log.recipient}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(log.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 text-xs font-medium px-2 py-0.5 rounded-full" title={log.errorMessage ?? ''}>
                            Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty states for summary/individual */}
      {viewMode !== 'history' && transactions.length === 0 && !qbLoading && (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <Mail className="w-12 h-12 mb-4 text-slate-700" />
          {dataSource === 'quickbooks' ? (
            <>
              <p className="text-slate-400 font-medium mb-1">No receipts loaded</p>
              <p className="text-slate-600 text-sm">Pick a date range above and click Load to pull sales receipts from QuickBooks.</p>
            </>
          ) : (
            <>
              <p className="text-slate-400 font-medium mb-1">No donation data loaded</p>
              <p className="text-slate-600 text-sm max-w-xs mb-6">Upload a donation file from the AI Assistant, or switch to QuickBooks to load receipts directly.</p>
              <Link href="/" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 px-4 rounded-xl transition-all">Go to AI Assistant</Link>
            </>
          )}
        </div>
      )}

      {/* Letters */}
      {viewMode !== 'history' && transactions.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6 print:max-w-none print:p-0 print:space-y-0">
          {viewMode === 'summary' ? (
            donorGroups.map((group, idx) => {
              const letterId = `merged-${idx}`;
              const isHidden = printingLetterId && printingLetterId !== letterId;
              return (
                <div key={letterId} className={`relative ${isHidden ? 'print:hidden' : ''}`}>
                  <div className="flex justify-end gap-2 mb-2 print:hidden flex-wrap">
                    {sendErrors[letterId] && (
                      <span className="text-red-400 text-xs self-center">{sendErrors[letterId]}</span>
                    )}
                    {group.email ? (
                      <button
                        onClick={() => handleSendEmail(letterId, group)}
                        disabled={sendingEmails[letterId] || !emailConfigured}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                          sentEmails[letterId]
                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {sendingEmails[letterId]
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                          : sentEmails[letterId]
                          ? <><CheckCircle className="w-3.5 h-3.5" /> Sent</>
                          : <><Send className="w-3.5 h-3.5" /> Send Email</>
                        }
                      </button>
                    ) : null}
                    <button
                      onClick={() => handlePrintSingle(letterId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
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
                <div key={letterId} className={`relative ${isHidden ? 'print:hidden' : ''}`}>
                  <div className="flex justify-end gap-2 mb-2 print:hidden">
                    {tx.donorEmail ? (
                      <button
                        onClick={() => handleSendEmail(letterId, { name: tx.donorName, email: tx.donorEmail, total: tx.grossAmount, donations: [tx] })}
                        disabled={sendingEmails[letterId] || !emailConfigured}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                          sentEmails[letterId]
                            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {sendingEmails[letterId]
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                          : sentEmails[letterId]
                          ? <><CheckCircle className="w-3.5 h-3.5" /> Sent</>
                          : <><Send className="w-3.5 h-3.5" /> Send Email</>
                        }
                      </button>
                    ) : null}
                    <button
                      onClick={() => handlePrintSingle(letterId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
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
      )}
    </div>
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

      <div className="mb-10 text-slate-800">
        <p className="font-semibold mb-1">To:</p>
        <p className="text-lg font-bold">{donorName || 'Valued Donor'}</p>
        <p className="text-slate-500">{donorEmail}</p>
      </div>

      <div className="flex-grow text-slate-700 leading-relaxed space-y-6">
        <p>Dear {donorName.split(' ')[0] || 'Friend'},</p>
        <p>
          Thank you for your generous contribution to <strong>{branding.organizationName}</strong>. Your support allows us to
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
