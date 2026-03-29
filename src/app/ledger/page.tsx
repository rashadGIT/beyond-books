'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { AppNav } from '@/components/AppNav';
import type { ParsedQbReport, ReportSection } from '@/lib/quickbooksService';

type Tab = 'accounts' | 'general' | 'trial' | 'ar' | 'ap';

interface QbAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  CurrentBalance?: number;
  AcctNum?: string;
  Active?: boolean;
}

interface ArEntry { customerName: string; totalBalance: number; invoices: any[] }
interface ApEntry { vendorName: string; totalBalance: number; bills: any[] }

const TABS: { key: Tab; label: string }[] = [
  { key: 'accounts', label: 'Chart of Accounts' },
  { key: 'general', label: 'General Ledger' },
  { key: 'trial', label: 'Trial Balance' },
  { key: 'ar', label: 'AR Subledger' },
  { key: 'ap', label: 'AP Subledger' },
];

const ACCOUNT_TYPES = ['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

function daysOverdue(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  const due = new Date(dueDateStr);
  const today = new Date();
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function overdueColor(days: number): string {
  if (days <= 0) return 'text-slate-400';
  if (days <= 30) return 'text-yellow-400';
  if (days <= 60) return 'text-orange-400';
  return 'text-red-400';
}

function fmt(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function LedgerPage() {
  const [tab, setTab] = useState<Tab>('accounts');
  const [qbConnected, setQbConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const loaded = useRef<Set<Tab>>(new Set());

  // Accounts tab
  const [accounts, setAccounts] = useState<QbAccount[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // General Ledger tab
  const [glStart, setGlStart] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [glEnd, setGlEnd] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [glData, setGlData] = useState<ParsedQbReport | null>(null);
  const [glExpanded, setGlExpanded] = useState<Set<string>>(new Set());
  const [glError, setGlError] = useState('');

  // Trial Balance tab
  const [tbStart, setTbStart] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [tbEnd, setTbEnd] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [tbData, setTbData] = useState<ParsedQbReport | null>(null);
  const [tbError, setTbError] = useState('');

  // AR / AP tabs
  const [arData, setArData] = useState<ArEntry[]>([]);
  const [apData, setApData] = useState<ApEntry[]>([]);
  const [arExpanded, setArExpanded] = useState<Set<string>>(new Set());
  const [apExpanded, setApExpanded] = useState<Set<string>>(new Set());

  // Check QB connection on mount
  useEffect(() => {
    fetch('/api/integrations/quickbooks/status')
      .then(r => r.ok ? r.json() : { connected: false })
      .then(d => setQbConnected(!!d.connected))
      .catch(() => setQbConnected(false));
  }, []);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetch('/api/ledger/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
        loaded.current.add('accounts');
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  // Load accounts when connected + on accounts tab
  useEffect(() => {
    if (qbConnected && tab === 'accounts' && !loaded.current.has('accounts')) {
      loadAccounts();
    }
  }, [qbConnected, tab]);

  async function loadAr() {
    if (loaded.current.has('ar')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ledger/ar');
      if (res.ok) { setArData(await res.json()); loaded.current.add('ar'); }
    } catch { /* silent */ }
    setLoading(false);
  }

  async function loadAp() {
    if (loaded.current.has('ap')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ledger/ap');
      if (res.ok) { setApData(await res.json()); loaded.current.add('ap'); }
    } catch { /* silent */ }
    setLoading(false);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'ar' && qbConnected) loadAr();
    if (t === 'ap' && qbConnected) loadAp();
  }

  async function loadGl() {
    setGlError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/ledger/general?start=${glStart}&end=${glEnd}`);
      if (res.ok) { setGlData(await res.json()); }
      else { const d = await res.json(); setGlError(d.error ?? 'Failed to load General Ledger.'); }
    } catch { setGlError('Network error loading General Ledger.'); }
    setLoading(false);
  }

  async function loadTb() {
    setTbError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/ledger/trial-balance?start=${tbStart}&end=${tbEnd}`);
      if (res.ok) { setTbData(await res.json()); }
      else { const d = await res.json(); setTbError(d.error ?? 'Failed to load Trial Balance.'); }
    } catch { setTbError('Network error loading Trial Balance.'); }
    setLoading(false);
  }

  async function saveAccountName(id: string) {
    if (!editName.trim()) { setEditingId(null); return; }
    setEditError(null);
    try {
      const res = await fetch(`/api/ledger/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setAccounts(prev => prev.map(a => a.Id === id ? { ...a, Name: data.Name ?? editName.trim() } : a));
        setEditingId(null);
      } else {
        setEditError(data.error ?? 'Failed to update account.');
      }
    } catch (e: any) {
      setEditError(e.message ?? 'Network error.');
    }
  }

  async function toggleActive(account: QbAccount) {
    try {
      const res = await fetch(`/api/ledger/accounts/${account.Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !account.Active }),
      });
      if (res.ok) {
        setAccounts(prev => prev.map(a => a.Id === account.Id ? { ...a, Active: !a.Active } : a));
      }
    } catch { /* silent */ }
  }

  const filteredAccounts = accounts.filter(a => {
    const matchSearch = a.Name.toLowerCase().includes(accountSearch.toLowerCase());
    const matchType = accountTypeFilter === 'All' || a.AccountType?.toLowerCase().includes(accountTypeFilter.toLowerCase());
    return matchSearch && matchType;
  });

  if (qbConnected === null) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-emerald-400" />
        <h1 className="text-lg font-bold text-white">Ledger</h1>
        <div className="ml-auto">
          <AppNav />
        </div>
      </div>

      {/* QB not connected gate */}
      {!qbConnected && (
        <div className="flex flex-col items-center justify-center h-96 space-y-4 px-6">
          <BookOpen className="w-12 h-12 text-slate-700" />
          <p className="text-amber-400 text-sm font-medium">QuickBooks not connected</p>
          <p className="text-slate-500 text-xs text-center max-w-xs">
            Connect QuickBooks in Settings to view your ledger and subledger data.
          </p>
          <Link
            href="/settings"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all"
          >
            Connect in Settings
          </Link>
        </div>
      )}

      {qbConnected && (
        <div className="px-6 py-6 max-w-7xl mx-auto">
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  tab === t.key
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && (
            <div className="text-slate-500 text-sm py-8 text-center">Loading...</div>
          )}

          {/* ── Chart of Accounts ─────────────────────────────────────────── */}
          {tab === 'accounts' && !loading && (
            <div className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={accountSearch}
                  onChange={e => setAccountSearch(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-64"
                />
                <select
                  value={accountTypeFilter}
                  onChange={e => setAccountTypeFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {filteredAccounts.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">
                  No accounts found. Make sure QuickBooks is connected and has a Chart of Accounts set up.
                </p>
              ) : (
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-4 py-3 w-16">#</th>
                        <th className="text-left px-4 py-3">Account Name</th>
                        <th className="text-left px-4 py-3">Type</th>
                        <th className="text-left px-4 py-3">Sub-Type</th>
                        <th className="text-right px-4 py-3">Balance</th>
                        <th className="text-center px-4 py-3">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((acc, i) => (
                        <tr
                          key={acc.Id}
                          className={`border-t border-slate-800 ${!acc.Active ? 'opacity-40' : ''} ${i % 2 === 0 ? 'bg-slate-900/30' : ''}`}
                        >
                          <td className="px-4 py-3 text-slate-500 text-xs">{acc.AcctNum ?? '—'}</td>
                          <td className="px-4 py-3">
                            {editingId === acc.Id ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <input
                                    autoFocus
                                    value={editName}
                                    onChange={e => { setEditName(e.target.value); setEditError(null); }}
                                    onKeyDown={e => { if (e.key === 'Enter') saveAccountName(acc.Id); if (e.key === 'Escape') { setEditingId(null); setEditError(null); } }}
                                    className="bg-slate-800 border border-emerald-500 rounded px-2 py-1 text-sm text-white focus:outline-none w-48"
                                  />
                                  <button onClick={() => saveAccountName(acc.Id)} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => { setEditingId(null); setEditError(null); }} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
                                </div>
                                {editError && <p className="text-red-400 text-xs max-w-xs">{editError}</p>}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <span className="text-slate-200">{acc.Name}</span>
                                <button
                                  onClick={() => { setEditingId(acc.Id); setEditName(acc.Name); }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-opacity"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{acc.AccountType}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{acc.AccountSubType ?? '—'}</td>
                          <td className={`px-4 py-3 text-right font-mono text-sm ${(acc.CurrentBalance ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {fmt(acc.CurrentBalance)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleActive(acc)}
                              className={`w-8 h-4 rounded-full transition-colors ${acc.Active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                              title={acc.Active ? 'Deactivate' : 'Activate'}
                            >
                              <span className={`block w-3 h-3 rounded-full bg-white mx-auto transition-transform ${acc.Active ? 'translate-x-2' : '-translate-x-1'}`} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── General Ledger ─────────────────────────────────────────────── */}
          {tab === 'general' && !loading && (
            <div className="space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Start Date</label>
                  <input type="date" value={glStart} onChange={e => setGlStart(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">End Date</label>
                  <input type="date" value={glEnd} onChange={e => setGlEnd(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
                <button onClick={loadGl}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
                  Load
                </button>
              </div>

              {glError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                  {glError.includes('not available') || glError.includes('subscription')
                    ? 'General Ledger report unavailable. Make sure your QuickBooks subscription includes this report.'
                    : glError}
                </div>
              )}

              {!glData && !glError && (
                <p className="text-slate-500 text-sm py-4">Select a date range and click Load to view the General Ledger.</p>
              )}

              {glData && (
                <div className="space-y-2">
                  {glData.sections.length === 0 ? (
                    <p className="text-slate-500 text-sm">No transactions found for this period.</p>
                  ) : glData.sections.map((section: ReportSection) => {
                    const isOpen = glExpanded.has(section.accountName);
                    return (
                      <div key={section.accountName} className="rounded-xl border border-slate-800 overflow-hidden">
                        <button
                          onClick={() => setGlExpanded(prev => { const s = new Set(prev); s.has(section.accountName) ? s.delete(section.accountName) : s.add(section.accountName); return s; })}
                          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors text-left"
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                          <span className="font-semibold text-slate-200 flex-1">{section.accountName}</span>
                          <span className="text-xs text-slate-500">{section.lines.length} transactions</span>
                          {section.summary['Balance'] && (
                            <span className="text-sm font-mono text-emerald-400 ml-4">{section.summary['Balance']}</span>
                          )}
                        </button>
                        {isOpen && section.lines.length > 0 && (
                          <table className="w-full text-xs">
                            <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider">
                              <tr>
                                {glData.columns.map(col => (
                                  <th key={col} className={`px-3 py-2 ${col === 'Amount' || col === 'Balance' ? 'text-right' : 'text-left'}`}>{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.lines.map((line, i) => (
                                <tr key={i} className={`border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                                  {glData.columns.map(col => (
                                    <td key={col} className={`px-3 py-2 ${col === 'Amount' || col === 'Balance' ? 'text-right font-mono text-slate-300' : 'text-slate-400'}`}>
                                      {line[col] ?? '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Trial Balance ──────────────────────────────────────────────── */}
          {tab === 'trial' && !loading && (
            <div className="space-y-4">
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Start Date</label>
                  <input type="date" value={tbStart} onChange={e => setTbStart(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">End Date</label>
                  <input type="date" value={tbEnd} onChange={e => setTbEnd(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
                </div>
                <button onClick={loadTb}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
                  Load
                </button>
              </div>

              {tbError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{tbError}</div>
              )}

              {!tbData && !tbError && (
                <p className="text-slate-500 text-sm py-4">Select a date range and click Load.</p>
              )}

              {tbData && (() => {
                const debitCol = tbData.columns.find(c => c.toLowerCase().includes('debit')) ?? tbData.columns[1];
                const creditCol = tbData.columns.find(c => c.toLowerCase().includes('credit')) ?? tbData.columns[2];
                const nameCol = tbData.columns[0];

                // Flatten all Data rows from sections
                const rows = tbData.sections.flatMap(s => s.lines);
                const totalDebit = rows.reduce((sum, r) => sum + (parseFloat(r[debitCol]?.replace(/,/g, '') || '0') || 0), 0);
                const totalCredit = rows.reduce((sum, r) => sum + (parseFloat(r[creditCol]?.replace(/,/g, '') || '0') || 0), 0);
                const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

                return (
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-4 py-3">Account</th>
                          <th className="text-right px-4 py-3">Debit</th>
                          <th className="text-right px-4 py-3">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={i} className={`border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900/30' : ''}`}>
                            <td className="px-4 py-2 text-slate-300">{row[nameCol] ?? '—'}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-300">{row[debitCol] || '—'}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-300">{row[creditCol] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className={`border-t-2 ${balanced ? 'border-emerald-500/50' : 'border-red-500/50'} font-bold`}>
                          <td className="px-4 py-3 text-slate-200">Total</td>
                          <td className={`px-4 py-3 text-right font-mono ${balanced ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(totalDebit)}
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${balanced ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmt(totalCredit)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    {!balanced && (
                      <div className="px-4 py-2 bg-red-500/10 text-red-400 text-xs border-t border-red-500/20">
                        Warning: Debits and credits do not balance (difference: {fmt(Math.abs(totalDebit - totalCredit))})
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── AR Subledger ───────────────────────────────────────────────── */}
          {tab === 'ar' && !loading && (
            <div className="space-y-2">
              {arData.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">No open invoices. All customer accounts are settled.</p>
              ) : arData.map((entry) => {
                const isOpen = arExpanded.has(entry.customerName);
                return (
                  <div key={entry.customerName} className="rounded-xl border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setArExpanded(prev => { const s = new Set(prev); s.has(entry.customerName) ? s.delete(entry.customerName) : s.add(entry.customerName); return s; })}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors text-left"
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                      <span className="flex-1 font-medium text-slate-200">{entry.customerName}</span>
                      <span className="text-xs text-slate-500">{entry.invoices.length} invoice{entry.invoices.length !== 1 ? 's' : ''}</span>
                      <span className="font-mono text-sm text-red-400 ml-4">{fmt(entry.totalBalance)}</span>
                    </button>
                    {isOpen && (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-4 py-2">Invoice #</th>
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Due Date</th>
                            <th className="text-right px-4 py-2">Amount</th>
                            <th className="text-right px-4 py-2">Days Overdue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.invoices.map((inv: any, i: number) => {
                            const days = daysOverdue(inv.DueDate);
                            return (
                              <tr key={inv.Id} className={`border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                                <td className="px-4 py-2 text-slate-300">{inv.DocNumber ?? inv.Id}</td>
                                <td className="px-4 py-2 text-slate-400">{inv.TxnDate}</td>
                                <td className="px-4 py-2 text-slate-400">{inv.DueDate ?? '—'}</td>
                                <td className="px-4 py-2 text-right font-mono text-slate-300">{fmt(parseFloat(inv.Balance))}</td>
                                <td className={`px-4 py-2 text-right font-mono ${overdueColor(days)}`}>
                                  {days > 0 ? `${days}d` : 'Current'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── AP Subledger ───────────────────────────────────────────────── */}
          {tab === 'ap' && !loading && (
            <div className="space-y-2">
              {apData.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">No open bills. All vendor accounts are settled.</p>
              ) : apData.map((entry) => {
                const isOpen = apExpanded.has(entry.vendorName);
                return (
                  <div key={entry.vendorName} className="rounded-xl border border-slate-800 overflow-hidden">
                    <button
                      onClick={() => setApExpanded(prev => { const s = new Set(prev); s.has(entry.vendorName) ? s.delete(entry.vendorName) : s.add(entry.vendorName); return s; })}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors text-left"
                    >
                      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                      <span className="flex-1 font-medium text-slate-200">{entry.vendorName}</span>
                      <span className="text-xs text-slate-500">{entry.bills.length} bill{entry.bills.length !== 1 ? 's' : ''}</span>
                      <span className="font-mono text-sm text-orange-400 ml-4">{fmt(entry.totalBalance)}</span>
                    </button>
                    {isOpen && (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-4 py-2">Bill #</th>
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Due Date</th>
                            <th className="text-right px-4 py-2">Total</th>
                            <th className="text-right px-4 py-2">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.bills.map((bill: any, i: number) => (
                            <tr key={bill.Id} className={`border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900/20' : ''}`}>
                              <td className="px-4 py-2 text-slate-300">{bill.DocNumber ?? bill.Id}</td>
                              <td className="px-4 py-2 text-slate-400">{bill.TxnDate}</td>
                              <td className="px-4 py-2 text-slate-400">{bill.DueDate ?? '—'}</td>
                              <td className="px-4 py-2 text-right font-mono text-slate-300">{fmt(parseFloat(bill.TotalAmt))}</td>
                              <td className="px-4 py-2 text-right font-mono text-orange-400">{fmt(parseFloat(bill.Balance))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
