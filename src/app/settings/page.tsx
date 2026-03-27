'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, Database, CheckCircle, XCircle, LogOut, ArrowLeft, Bot, Eye, EyeOff, RefreshCw, X, Check, Clock, Mail } from 'lucide-react';
import { AppNav } from '@/components/AppNav';

type AIProvider = 'anthropic' | 'openai' | 'google';
type SyncFrequency = 'HOURLY' | 'DAILY' | 'WEEKLY';

const FREQUENCY_LABELS: Record<SyncFrequency, string> = {
  HOURLY: 'Hourly',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
};

const PROVIDER_LABELS: Record<AIProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (ChatGPT)',
  google: 'Google (Gemini)',
};

interface SavedAIKey {
  provider: AIProvider;
  model: string;
  maskedKey: string;
  isActive: boolean;
}

export default function SettingsPage() {
  const router = useRouter();

  // QuickBooks state
  const [qbStatus, setQbStatus] = useState<{
    connected: boolean;
    companyName?: string;
    lastSyncAt?: string;
  }>({ connected: false });
  const [loadingQb, setLoadingQb] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Branding state
  const [branding, setBranding] = useState({ orgName: '', tagLine: '', taxId: '', signerName: '', signerTitle: '', primaryColor: '' });
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingMessage, setBrandingMessage] = useState('');

  // Auto-sync state
  const [autoSync, setAutoSync] = useState({ enabled: false, cron: '' as string | null });
  const [syncSchedule, setSyncSchedule] = useState('09:00 AM');
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('DAILY');
  const [savingSync, setSavingSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Saved AI keys list
  const [savedKeys, setSavedKeys] = useState<SavedAIKey[]>([]);
  const [loadingAI, setLoadingAI] = useState(true);
  const [activatingProvider, setActivatingProvider] = useState<string | null>(null);
  const [removingProvider, setRemovingProvider] = useState<string | null>(null);

  // Add/update key form state
  const [formProvider, setFormProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [aiModel, setAiModel] = useState('');
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState('');
  const [savingAI, setSavingAI] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Email provider state
  const [emailConfig, setEmailConfig] = useState<{ configured: boolean; provider?: string; fromEmail?: string; fromName?: string; hasApiKey?: boolean } | null>(null);
  const [emailForm, setEmailForm] = useState({ fromName: '', fromEmail: '' });
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [disconnectingEmail, setDisconnectingEmail] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('qb_connected') || params.get('qb_error')) {
      window.history.replaceState({}, '', '/settings');
    }
    if (params.get('email_connected') === 'gmail') {
      setEmailMessage('Gmail connected successfully!');
      window.history.replaceState({}, '', '/settings');
    }
    if (params.get('email_error')) {
      setEmailMessage('Gmail connection failed. Please try again.');
      window.history.replaceState({}, '', '/settings');
    }

    fetch('/api/integrations/quickbooks/status')
      .then(r => r.json())
      .then(data => { setQbStatus(data); setLoadingQb(false); })
      .catch(() => setLoadingQb(false));

    fetch('/api/settings/branding')
      .then(r => r.json())
      .then(data => {
        setBranding({
          orgName: data.orgName ?? '',
          tagLine: data.tagLine ?? '',
          taxId: data.taxId ?? '',
          signerName: data.signerName ?? '',
          signerTitle: data.signerTitle ?? '',
          primaryColor: data.primaryColor ?? '',
        });
      })
      .catch(() => {});

    fetch('/api/settings/sync-schedule')
      .then(r => r.json())
      .then(data => {
        setAutoSync({ enabled: data.autoSyncEnabled ?? false, cron: data.autoSyncCron ?? null });
      })
      .catch(() => {});

    loadAIKeys();

    fetch('/api/settings/email')
      .then(r => r.json())
      .then(data => {
        setEmailConfig(data);
        if (data.configured) {
          setEmailForm(f => ({
            ...f,
            fromName: data.fromName ?? '',
            fromEmail: data.fromEmail ?? '',
          }));
        }
      })
      .catch(() => {});
  }, []);

  async function loadAIKeys() {
    try {
      const res = await fetch('/api/settings/ai');
      const data = await res.json();
      setSavedKeys(Array.isArray(data) ? data : []);
    } catch {}
    setLoadingAI(false);
  }

  // Debounced model fetch when provider or key changes
  useEffect(() => {
    if (!apiKey.trim()) { setModels([]); setAiModel(''); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadModels(formProvider, apiKey.trim()), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formProvider, apiKey]);

  const handleProviderChange = (p: AIProvider) => {
    setFormProvider(p);
    setAiModel('');
    setModels([]);
    setModelFetchError('');
  };

  async function loadModels(provider: AIProvider, key: string) {
    setFetchingModels(true);
    setModelFetchError('');
    try {
      const res = await fetch('/api/settings/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setModels(data.models);
      if (data.models.length > 0) {
        setAiModel(prev => data.models.includes(prev) ? prev : data.models[0]);
      }
    } catch (err: any) {
      setModelFetchError(err.message || 'Failed to load models');
      setModels([]);
    }
    setFetchingModels(false);
  }

  const handleSaveAI = async () => {
    if (!apiKey.trim()) { setAiMessage('Please enter an API key.'); return; }
    if (!aiModel) { setAiMessage('Please load and select a model first.'); return; }
    setSavingAI(true);
    setAiMessage('');
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: formProvider, apiKey: apiKey.trim(), model: aiModel }),
      });
      const data = await res.json();
      if (res.ok) {
        setApiKey('');
        setModels([]);
        setAiModel('');
        setAiMessage('Saved!');
        await loadAIKeys();
      } else {
        setAiMessage(data?.error || `Error ${res.status}`);
      }
    } catch (err: any) {
      setAiMessage(err.message || 'Network error.');
    }
    setSavingAI(false);
  };

  const handleSetActive = async (provider: AIProvider) => {
    setActivatingProvider(provider);
    await fetch('/api/settings/ai', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    await loadAIKeys();
    setActivatingProvider(null);
  };

  const handleRemove = async (provider: AIProvider) => {
    setRemovingProvider(provider);
    await fetch('/api/settings/ai', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    await loadAIKeys();
    setRemovingProvider(null);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    await fetch('/api/quickbooks/disconnect', { method: 'POST' });
    setQbStatus({ connected: false });
    setDisconnecting(false);
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    setBrandingMessage('');
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setBrandingMessage('Saved!');
    } catch (err: any) {
      setBrandingMessage(err.message || 'Failed to save.');
    }
    setSavingBranding(false);
  };

  const handleSyncSave = async (enabled: boolean) => {
    setSavingSync(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/settings/sync-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          schedule: syncSchedule,
          frequency: syncFrequency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setAutoSync({ enabled: data.autoSyncEnabled, cron: data.autoSyncCron });
      setSyncMessage(enabled ? 'Auto-sync enabled!' : 'Auto-sync disabled.');
    } catch (err: any) {
      setSyncMessage(err.message || 'Failed to save.');
    }
    setSavingSync(false);
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    setEmailMessage('');
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...emailForm, provider: 'ses' }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailConfig({ configured: true, provider: 'ses', fromEmail: emailForm.fromEmail, fromName: emailForm.fromName });
        setEmailMessage('Saved!');
      } else {
        setEmailMessage(data.error || `Error ${res.status}`);
      }
    } catch (err: any) {
      setEmailMessage(err.message || 'Network error.');
    }
    setSavingEmail(false);
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailMessage('');
    try {
      const action = 'test';
      const body = { action };
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setEmailMessage(`Test email sent to ${emailForm.fromEmail || emailConfig?.fromEmail}!`);
      } else {
        setEmailMessage(data.error || 'Test failed.');
      }
    } catch (err: any) {
      setEmailMessage(err.message || 'Network error.');
    }
    setTestingEmail(false);
  };

  const handleDisconnectEmail = async () => {
    setDisconnectingEmail(true);
    setEmailMessage('');
    try {
      await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setEmailConfig({ configured: false });
      setEmailForm({ fromName: '', fromEmail: '' });
      setEmailMessage('Disconnected.');
    } catch {}
    setDisconnectingEmail(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/sign-in');
  };

  const activeKey = savedKeys.find(k => k.isActive);
  const formProviderAlreadySaved = savedKeys.some(k => k.provider === formProvider);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 p-6">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            Settings
          </h1>
          <AppNav />
        </div>

        {/* QuickBooks Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Database className="w-4 h-4" />
            QuickBooks
          </h2>
          {loadingQb ? (
            <div className="text-slate-500 text-sm">Checking connection...</div>
          ) : qbStatus.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-emerald-400 text-sm font-medium">{qbStatus.companyName || 'Connected'}</p>
                  {qbStatus.lastSyncAt && (
                    <p className="text-slate-500 text-xs">
                      Last synced {new Date(qbStatus.lastSyncAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect QuickBooks'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <p className="text-orange-400 text-sm">Not connected</p>
              </div>
              <p className="text-slate-500 text-xs">
                Connect your QuickBooks account so the AI assistant can read your financial data.
              </p>
              <a
                href="/api/quickbooks/connect"
                className="block w-full text-center bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-bold transition-all"
              >
                Connect QuickBooks
              </a>
            </div>
          )}
        </div>

        {/* Letter Branding Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Letter Branding
          </h2>
          <p className="text-slate-500 text-xs">
            These details appear on donation acknowledgment letters sent to donors.
          </p>
          <div className="space-y-3">
            {[
              { key: 'orgName', label: 'Organization Name', placeholder: 'Youth Revive Inc.' },
              { key: 'tagLine', label: 'Tagline', placeholder: 'Building stronger communities together' },
              { key: 'taxId', label: 'Tax ID (EIN)', placeholder: '84-1234567' },
              { key: 'signerName', label: 'Signer Name', placeholder: 'Jane Smith' },
              { key: 'signerTitle', label: 'Signer Title', placeholder: 'Executive Director' },
              { key: 'primaryColor', label: 'Brand Color (hex)', placeholder: '#2563eb' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{label}</label>
                <input
                  type="text"
                  value={branding[key as keyof typeof branding]}
                  onChange={e => setBranding(b => ({ ...b, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>
            ))}
          </div>
          {brandingMessage && (
            <p className={`text-xs ${brandingMessage === 'Saved!' ? 'text-emerald-400' : 'text-slate-400'}`}>
              {brandingMessage}
            </p>
          )}
          <button
            onClick={handleSaveBranding}
            disabled={savingBranding}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-medium transition-all"
          >
            {savingBranding ? 'Saving...' : 'Save Branding'}
          </button>
        </div>

        {/* Auto-Sync Card — only shown when QB is connected */}
        {qbStatus.connected && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Auto-Sync
              </h2>
              {/* Toggle */}
              <button
                onClick={() => handleSyncSave(!autoSync.enabled)}
                disabled={savingSync}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  autoSync.enabled ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
                aria-label="Toggle auto-sync"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoSync.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-slate-500 text-xs">
              Automatically pull new transactions from QuickBooks on a schedule.
            </p>

            {/* Schedule options — only editable when enabled or about to enable */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Time</label>
                <input
                  type="text"
                  value={syncSchedule}
                  onChange={e => setSyncSchedule(e.target.value)}
                  placeholder="09:00 AM"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Frequency</label>
                <select
                  value={syncFrequency}
                  onChange={e => setSyncFrequency(e.target.value as SyncFrequency)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {(Object.keys(FREQUENCY_LABELS) as SyncFrequency[]).map(f => (
                    <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>
            </div>

            {autoSync.enabled && (
              <button
                onClick={() => handleSyncSave(true)}
                disabled={savingSync}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-medium transition-all"
              >
                {savingSync ? 'Saving...' : 'Update Schedule'}
              </button>
            )}

            {autoSync.cron && (
              <p className="text-slate-500 text-xs">
                Current: <span className="text-slate-300 font-mono">{autoSync.cron}</span>
              </p>
            )}

            {syncMessage && (
              <p className={`text-xs ${syncMessage.includes('!') ? 'text-emerald-400' : 'text-slate-400'}`}>
                {syncMessage}
              </p>
            )}
          </div>
        )}

        {/* AI Settings Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI Assistant
            </h2>
            {!loadingAI && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${activeKey ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                {activeKey ? `Using ${PROVIDER_LABELS[activeKey.provider].split(' ')[0]} key` : 'Using shared key'}
              </span>
            )}
          </div>

          {loadingAI ? (
            <div className="text-slate-500 text-sm">Loading...</div>
          ) : (
            <div className="space-y-4">

              {/* Saved keys list — each with inline Use + Remove */}
              {savedKeys.length > 0 && (
                <div className="space-y-2">
                  {savedKeys.map(key => (
                    <div
                      key={key.provider}
                      className={`rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs ${
                        key.isActive
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : 'bg-slate-800 border border-slate-700'
                      }`}
                    >
                      {/* Active indicator dot */}
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${key.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />

                      {/* Provider + model */}
                      <div className="flex-1 min-w-0">
                        <span className={`font-semibold ${key.isActive ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {PROVIDER_LABELS[key.provider].split(' ')[0]}
                        </span>
                        <span className="text-slate-500 mx-1">·</span>
                        <span className="text-slate-400 truncate">{key.model}</span>
                      </div>

                      {/* Masked key */}
                      <span className="font-mono text-slate-500 hidden sm:inline flex-shrink-0">{key.maskedKey}</span>

                      {/* Use / Active badge */}
                      {key.isActive ? (
                        <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-wide px-1 flex-shrink-0">Active</span>
                      ) : (
                        <button
                          onClick={() => handleSetActive(key.provider)}
                          disabled={activatingProvider === key.provider}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-blue-500/10 transition-all whitespace-nowrap flex-shrink-0"
                        >
                          {activatingProvider === key.provider
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Check className="w-3 h-3" />}
                          Use
                        </button>
                      )}

                      {/* Remove button — inline next to the key */}
                      <button
                        onClick={() => handleRemove(key.provider)}
                        disabled={removingProvider === key.provider}
                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-all"
                        title={`Remove ${PROVIDER_LABELS[key.provider]} key`}
                      >
                        {removingProvider === key.provider
                          ? <RefreshCw className="w-3 h-3 animate-spin" />
                          : <X className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Divider + label when keys already exist */}
              {savedKeys.length > 0 && (
                <div className="border-t border-slate-800 pt-1">
                  <p className="text-xs text-slate-600 mb-0">
                    {formProviderAlreadySaved
                      ? `Update ${PROVIDER_LABELS[formProvider].split(' ')[0]} key`
                      : 'Add another provider'}
                  </p>
                </div>
              )}

              {/* Provider selector */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Provider</label>
                <select
                  value={formProvider}
                  onChange={e => handleProviderChange(e.target.value as AIProvider)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map(p => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}{savedKeys.some(k => k.provider === p) ? ' (saved)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  API Key{formProviderAlreadySaved ? ' (enter new key to replace)' : ''}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={
                      formProviderAlreadySaved
                        ? savedKeys.find(k => k.provider === formProvider)?.maskedKey
                        : 'Paste your API key here'
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {apiKey && (
                  <p className="text-slate-600 text-xs mt-1 flex items-center gap-1">
                    {fetchingModels
                      ? <><RefreshCw className="w-3 h-3 animate-spin" /> Loading models...</>
                      : modelFetchError
                      ? <span className="text-red-400">{modelFetchError}</span>
                      : models.length > 0
                      ? <span className="text-emerald-500">{models.length} models loaded</span>
                      : null}
                  </p>
                )}
              </div>

              {/* Model dropdown */}
              {models.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Model
                    <button
                      type="button"
                      onClick={() => loadModels(formProvider, apiKey)}
                      className="ml-2 text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5"
                    >
                      <RefreshCw className="w-3 h-3" /> refresh
                    </button>
                  </label>
                  <select
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {!apiKey && savedKeys.length === 0 && (
                <p className="text-slate-600 text-xs">
                  Paste your API key above — models will load automatically.
                </p>
              )}

              {aiMessage && (
                <p className={`text-xs ${aiMessage === 'Saved!' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {aiMessage}
                </p>
              )}

              <button
                onClick={handleSaveAI}
                disabled={savingAI || !apiKey.trim() || !aiModel}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-xl text-sm font-medium transition-all"
              >
                {savingAI
                  ? 'Saving...'
                  : formProviderAlreadySaved
                  ? `Update ${PROVIDER_LABELS[formProvider].split(' ')[0]} Key`
                  : 'Save Key'}
              </button>

            </div>
          )}
        </div>

        {/* Email Sending Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Sending
          </h2>
          <p className="text-slate-500 text-xs">
            Donation letters are sent on your behalf. Donor replies go directly to your Reply-To address.
          </p>

          {/* Connected state */}
          {emailConfig?.configured && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-emerald-300 text-xs font-medium">Configured: {emailConfig.fromName}</p>
                <p className="text-slate-500 text-xs">Replies go to {emailConfig.fromEmail}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Organization Name</label>
              <input
                type="text"
                value={emailForm.fromName}
                onChange={e => setEmailForm(f => ({ ...f, fromName: e.target.value }))}
                placeholder="Youth Revive Inc."
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Reply-To Email</label>
              <input
                type="email"
                value={emailForm.fromEmail}
                onChange={e => setEmailForm(f => ({ ...f, fromEmail: e.target.value }))}
                placeholder="you@yourorg.org"
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
              />
              <p className="text-slate-600 text-xs mt-1">Donor replies will be sent to this address</p>
            </div>
          </div>

          {emailMessage && (
            <p className={`text-xs ${emailMessage === 'Saved!' || emailMessage.startsWith('Test email sent') ? 'text-emerald-400' : 'text-slate-400'}`}>
              {emailMessage}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSaveEmail}
              disabled={savingEmail || !emailForm.fromName || !emailForm.fromEmail}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-xl text-sm font-medium transition-all"
            >
              {savingEmail ? 'Saving...' : emailConfig?.configured ? 'Update' : 'Save'}
            </button>
            {emailConfig?.configured && (
              <button
                onClick={handleTestEmail}
                disabled={testingEmail}
                className="flex-1 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
              >
                {testingEmail ? 'Sending...' : 'Send Test'}
              </button>
            )}
            {emailConfig?.configured && (
              <button
                onClick={handleDisconnectEmail}
                disabled={disconnectingEmail}
                className="border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {disconnectingEmail ? '...' : 'Remove'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
