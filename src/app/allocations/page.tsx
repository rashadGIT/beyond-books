'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { GitBranch, Plus, Trash2, Percent, Receipt } from 'lucide-react';
import { MarkdownMessage } from '@/components/MarkdownMessage';
import { AppNav } from '@/components/AppNav';

interface Program {
  id: string;
  name: string;
  type: string;
  qbClassId?: string;
  isActive: boolean;
}

interface AllocationSplit {
  id: string;
  programId: string;
  percentage: number;
  program: Program;
}

interface AllocationRule {
  id: string;
  name: string;
  splits: AllocationSplit[];
}

const TYPE_COLORS: Record<string, string> = {
  PROGRAM: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  LOCATION: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  GRANT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

export default function AllocationsPage() {
  const [tab, setTab] = useState<'programs' | 'rules' | 'bill'>('programs');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [loading, setLoading] = useState(true);

  // New program form
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramType, setNewProgramType] = useState<'PROGRAM' | 'LOCATION' | 'GRANT'>('PROGRAM');
  const [addingProgram, setAddingProgram] = useState(false);

  // New rule form
  const [newRuleName, setNewRuleName] = useState('');
  const [ruleSplits, setRuleSplits] = useState<{ programId: string; percentage: number }[]>([{ programId: '', percentage: 100 }]);
  const [addingRule, setAddingRule] = useState(false);
  const [formError, setFormError] = useState('');

  // Quick Bill form
  const [billVendor, setBillVendor] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billAccount, setBillAccount] = useState('');
  const [billRuleId, setBillRuleId] = useState('');
  const [billMemo, setBillMemo] = useState('');
  const [submittingBill, setSubmittingBill] = useState(false);
  const [billResult, setBillResult] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch('/api/allocations/programs'),
        fetch('/api/allocations/rules'),
      ]);
      const [p, r] = await Promise.all([
        pRes.ok ? pRes.json() : [],
        rRes.ok ? rRes.json() : [],
      ]);
      setPrograms(Array.isArray(p) ? p : []);
      setRules(Array.isArray(r) ? r : []);
    } catch {
      // Network error — show empty state
    }
    setLoading(false);
  }

  async function handleAddProgram() {
    if (!newProgramName.trim()) return;
    setAddingProgram(true);
    await fetch('/api/allocations/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProgramName.trim(), type: newProgramType }),
    });
    setNewProgramName('');
    await loadAll();
    setAddingProgram(false);
  }

  async function handleDeleteProgram(id: string) {
    await fetch('/api/allocations/programs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadAll();
  }

  async function handleAddRule() {
    setFormError('');
    if (!newRuleName.trim()) { setFormError('Rule name is required.'); return; }
    const total = ruleSplits.reduce((s, sp) => s + sp.percentage, 0);
    if (Math.abs(total - 100) > 0.01) { setFormError(`Splits must sum to 100% (currently ${total}%).`); return; }
    if (ruleSplits.some(sp => !sp.programId)) { setFormError('Select a program for each split.'); return; }

    setAddingRule(true);
    const res = await fetch('/api/allocations/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRuleName.trim(), splits: ruleSplits }),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error ?? 'Failed to create rule'); setAddingRule(false); return; }
    setNewRuleName('');
    setRuleSplits([{ programId: '', percentage: 100 }]);
    await loadAll();
    setAddingRule(false);
  }

  async function handleCreateBill() {
    setBillResult('');
    if (!billVendor.trim() || !billAmount || !billAccount.trim() || !billRuleId) {
      setBillResult('All fields are required.');
      return;
    }
    setSubmittingBill(true);
    const { sendToChatAsUser } = await import('@/lib/chatBridge');
    try {
      const result = await sendToChatAsUser(
        `Create a $${billAmount} bill to ${billVendor} for ${billAccount}, split using allocation rule ID ${billRuleId}${billMemo ? `, memo: ${billMemo}` : ''}.`,
        { context: { allocationRuleId: billRuleId, vendor: billVendor, totalAmount: parseFloat(billAmount), expenseAccount: billAccount, memo: billMemo } }
      );
      setBillResult(result || 'Bill submitted to AI. Check the chat for confirmation.');
      setBillVendor(''); setBillAmount(''); setBillAccount(''); setBillMemo('');
    } catch (err: any) {
      setBillResult(err.message || 'Failed to submit bill.');
    }
    setSubmittingBill(false);
  }

  async function handleDeleteRule(id: string) {
    await fetch('/api/allocations/rules', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadAll();
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-400" />
            Allocations
          </h1>
          <AppNav />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {(['programs', 'rules', 'bill'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
                tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'bill' ? 'Quick Bill' : t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading...</div>
        ) : tab === 'programs' ? (
          <>
            {/* Programs list */}
            <div className="space-y-2">
              {programs.length === 0 && (
                <p className="text-slate-500 text-sm">No programs yet. Add one below or ask the AI assistant.</p>
              )}
              {programs.map(p => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[p.type] ?? 'bg-slate-700 text-slate-400'}`}>
                    {p.type}
                  </span>
                  <span className="flex-1 font-medium text-slate-200">{p.name}</span>
                  {p.qbClassId && (
                    <span className="text-[10px] text-slate-500 font-mono">QB:{p.qbClassId}</span>
                  )}
                  <button
                    onClick={() => handleDeleteProgram(p.id)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add program form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Program
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newProgramName}
                  onChange={e => setNewProgramName(e.target.value)}
                  placeholder="Program name"
                  className="col-span-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
                <select
                  value={newProgramType}
                  onChange={e => setNewProgramType(e.target.value as typeof newProgramType)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="PROGRAM">Program</option>
                  <option value="LOCATION">Location</option>
                  <option value="GRANT">Grant</option>
                </select>
                <button
                  onClick={handleAddProgram}
                  disabled={addingProgram || !newProgramName.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all"
                >
                  {addingProgram ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </>
        ) : tab === 'bill' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Quick Bill
            </h3>
            <p className="text-slate-500 text-xs">Create a QB bill split across programs via an allocation rule.</p>

            <div className="space-y-3">
              {[
                { label: 'Vendor', value: billVendor, set: setBillVendor, placeholder: 'Office Depot' },
                { label: 'Amount ($)', value: billAmount, set: setBillAmount, placeholder: '500.00' },
                { label: 'Expense Account', value: billAccount, set: setBillAccount, placeholder: 'Office Supplies' },
                { label: 'Memo (optional)', value: billMemo, set: setBillMemo, placeholder: 'Q1 supplies' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs text-slate-500 mb-1">Allocation Rule</label>
                <select
                  value={billRuleId}
                  onChange={e => setBillRuleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select a rule…</option>
                  {rules.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.splits.map(s => `${s.program.name} ${s.percentage}%`).join(', ')})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {billResult && (
              <div className={`text-xs rounded-xl p-3 bg-slate-800 ${billResult.toLowerCase().includes('fail') || billResult.toLowerCase().includes('error') ? 'text-red-400' : 'text-slate-200'}`}>
                <MarkdownMessage content={billResult} role="assistant" />
              </div>
            )}

            <button
              onClick={handleCreateBill}
              disabled={submittingBill || !billVendor || !billAmount || !billAccount || !billRuleId}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-bold transition-all"
            >
              {submittingBill ? 'Creating bill...' : 'Create Bill via AI'}
            </button>
          </div>
        ) : (
          <>
            {/* Rules list */}
            <div className="space-y-3">
              {rules.length === 0 && (
                <p className="text-slate-500 text-sm">No allocation rules yet. Create one below.</p>
              )}
              {rules.map(rule => (
                <div key={rule.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{rule.name}</span>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {rule.splits.map(sp => (
                      <div key={sp.id} className="flex items-center gap-2">
                        <div
                          className="h-2 rounded-full bg-purple-500/60"
                          style={{ width: `${sp.percentage}%`, minWidth: '8px' }}
                        />
                        <span className="text-slate-300 text-sm flex-1">{sp.program.name}</span>
                        <span className="text-slate-400 text-xs font-mono">{sp.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add rule form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Allocation Rule
              </h3>
              <input
                type="text"
                value={newRuleName}
                onChange={e => setNewRuleName(e.target.value)}
                placeholder="Rule name (e.g. Admin Overhead Split)"
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />

              <div className="space-y-2">
                {ruleSplits.map((sp, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
                    <select
                      value={sp.programId}
                      onChange={e => {
                        const copy = [...ruleSplits];
                        copy[i] = { ...copy[i], programId: e.target.value };
                        setRuleSplits(copy);
                      }}
                      className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select program…</option>
                      {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={sp.percentage}
                        onChange={e => {
                          const copy = [...ruleSplits];
                          copy[i] = { ...copy[i], percentage: parseFloat(e.target.value) || 0 };
                          setRuleSplits(copy);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 pr-6 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => setRuleSplits(ruleSplits.filter((_, j) => j !== i))}
                      disabled={ruleSplits.length <= 1}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setRuleSplits([...ruleSplits, { programId: '', percentage: 0 }])}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add split
                </button>
                <span className={`text-xs font-mono ${Math.abs(ruleSplits.reduce((s, sp) => s + sp.percentage, 0) - 100) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Total: {ruleSplits.reduce((s, sp) => s + sp.percentage, 0)}%
                </span>
              </div>

              {formError && <p className="text-red-400 text-xs">{formError}</p>}

              <button
                onClick={handleAddRule}
                disabled={addingRule || !newRuleName.trim()}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-medium transition-all"
              >
                {addingRule ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
