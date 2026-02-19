'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, Database, CheckCircle, XCircle, LogOut, ArrowLeft, Bot, Eye, EyeOff, RefreshCw, X, Check } from 'lucide-react';

type AIProvider = 'anthropic' | 'openai' | 'google';

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('qb_connected') || params.get('qb_error')) {
      window.history.replaceState({}, '', '/settings');
    }

    fetch('/api/integrations/quickbooks/status')
      .then(r => r.json())
      .then(data => { setQbStatus(data); setLoadingQb(false); })
      .catch(() => setLoadingQb(false));

    loadAIKeys();
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
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-500" />
              Settings
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
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

      </div>
    </div>
  );
}
