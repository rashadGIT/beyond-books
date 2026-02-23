'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  BrainCircuit,
  Cpu,
  Send,
  Terminal,
  Layers,
  Sparkles,
  Menu,
  X,
  Play,
  Bot,
  Paperclip,
  AlertCircle,
  Settings,
  LogOut,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MarkdownMessage } from '@/components/MarkdownMessage';

type AIStatus = 'idle' | 'thinking' | 'working';

interface Job {
  id: string;
  prompt: string;        // AI prompt
  label: string;
  schedule: string;
  frequency?: string;
  cronExpression?: string;
  isActive?: boolean;
  lastRunAt?: string;
}

interface Execution {
  id: string;
  status: string;
  result?: string;
  latency?: string;
  startedAt: string;
  job: Job;
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

export default function WorkflowDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState<AIStatus>('idle');
  const [userInput, setUserInput] = useState('');
  const [, setCurrentQuery] = useState<string | null>(null);
  const [activeMobileTab, setActiveTab] = useState<'queue' | 'ai' | 'output'>('ai');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<Execution[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qbStatus, setQbStatus] = useState<{
    connected: boolean;
    lastSyncAt: string | null;
    error: string | null;
  }>({ connected: false, lastSyncAt: null, error: null });
  const [aiSettings, setAiSettings] = useState<{
    provider: string;
    model: string;
    maskedKey: string;
  } | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [newJob, setNewJob] = useState({ prompt: '', label: '', schedule: '09:00 AM', frequency: 'DAILY' });

  const fetchData = async () => {
    try {
      const [jobsRes, chatRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/chat')
      ]);
      const jobsData = await jobsRes.json();
      const chatData = await chatRes.json();
      
      setJobs(jobsData.jobs || []);
      setHistory(jobsData.history || []);
      setMessages(Array.isArray(chatData) ? chatData : []);
    } catch (err) {
      console.error('Data sync failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, status]);

  useEffect(() => {
    const fetchQBStatus = async () => {
      try {
        const res = await fetch('/api/integrations/quickbooks/status');
        const data = await res.json();
        setQbStatus(data);
      } catch (err) {
        console.error('Failed to fetch QB status:', err);
      }
    };

    const fetchAISettings = async () => {
      try {
        const res = await fetch('/api/settings/ai');
        const data = await res.json();
        // API now returns an array; pick the active one
        const active = Array.isArray(data) ? data.find((s: { isActive?: boolean }) => s.isActive) ?? null : null;
        setAiSettings(active);
      } catch {}
    };

    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        setUserName(data.name || data.email || null);
      } catch {}
    };

    fetchQBStatus();
    fetchAISettings();
    fetchMe();

    const interval = setInterval(fetchQBStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Delete this scheduled task?')) return;
    try {
      await fetch('/api/jobs', {
        method: 'DELETE',
        body: JSON.stringify({ jobId }),
        headers: { 'Content-Type': 'application/json' },
      });
      fetchData();
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(newJob),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to create job:', error);
        alert(`Error: ${error.error || 'Failed to create job'}`);
        return;
      }

      setIsCreatingJob(false);
      setNewJob({ prompt: '', label: '', schedule: '09:00 AM', frequency: 'DAILY' });
      fetchData();
    } catch (err) {
      console.error('Failed to create job:', err);
      alert('Failed to create job. Check console for details.');
    }
  };

  const handleManualRun = async (jobId: string, label: string) => {
    setCurrentQuery(label);
    setStatus('thinking');
    setActiveTab('ai');
    
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify({ jobId }),
        headers: { 'Content-Type': 'application/json' }
      });
      const execution = await res.json();
      
      setStatus('working');
      await new Promise(r => setTimeout(r, 1500));
      
      setStatus('idle');
      setCurrentQuery(null);
      fetchData();
      return execution.result;
    } catch {
      setStatus('idle');
      setCurrentQuery(null);
      return "Execution error.";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      const uploadData = await uploadRes.json();

      // Create user message with file attachment
      const userContent = `Uploaded file: ${uploadData.summary.filename} (${uploadData.summary.transactionCount} transactions, $${uploadData.summary.totalAmount.toFixed(2)})`;

      // Use existing message persistence
      const savedUserMsg = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: userContent }),
        headers: { 'Content-Type': 'application/json' }
      }).then(r => r.json());

      setMessages(prev => [...prev, savedUserMsg]);

      // Generate assistant response
      const assistantContent = `File processed successfully!\n\n**Summary:**\n- Source: ${uploadData.summary.source}\n- Transactions: ${uploadData.summary.transactionCount}\n- Total: $${uploadData.summary.totalAmount.toFixed(2)}\n\nReady for letter generation. Try "show stats" or "list donors".`;

      const savedAssistantMsg = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ role: 'assistant', content: assistantContent }),
        headers: { 'Content-Type': 'application/json' }
      }).then(r => r.json());

      setMessages(prev => [...prev, savedAssistantMsg]);
    } catch (err) {
      setError('File upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isTyping) return;

    const content = userInput;
    setUserInput('');
    setError(null);

    // Show message immediately — don't wait for AI response
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: optimisticId,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    }]);

    try {
      setIsTyping(true);
      setStatus('thinking');

      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('Failed to send message');

      const data = await res.json();

      // Replace optimistic message with real persisted messages
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticId),
        data.userMessage,
        data.assistantMessage,
      ]);
      fetchData(); // refresh jobs in case AI created one
      setStatus('idle');
<<<<<<< HEAD
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setError('Communication error: ' + err.message);
=======
    } catch (err) {
      setError('Communication error: ' + (err instanceof Error ? err.message : 'Unknown error'));
>>>>>>> master
      setStatus('idle');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 font-sans overflow-hidden flex-col lg:flex-row">
      
      {/* Mobile Header */}
      <header className="lg:hidden h-16 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center space-x-2 text-white">
          <div className="bg-blue-600 p-1 rounded-lg"><Layers className="w-4 h-4" /></div>
          <span className="font-bold text-sm tracking-tight uppercase tracking-widest">ReviveAI</span>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-400">
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* 1. Queue Section */}
      <aside className={`
        ${activeMobileTab === 'queue' ? 'flex' : 'hidden lg:flex'} 
        w-full lg:w-80 bg-[#0F172A]/50 border-r border-slate-800 flex-col p-6 space-y-6 shrink-0 overflow-y-auto
      `}>
        <div className="flex items-center justify-between mb-4">
          <div className="hidden lg:flex items-center space-x-2 text-white">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Layers className="w-5 h-5" /></div>
            <span className="font-bold text-lg uppercase tracking-tight">Queue</span>
          </div>
          <button 
            onClick={() => setIsCreatingJob(!isCreatingJob)}
            className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:text-white transition-all group"
            title="Schedule New Task"
          >
            {isCreatingJob ? <X className="w-4 h-4" /> : <Play className="w-4 h-4 rotate-90 group-hover:text-blue-400" />}
          </button>
        </div>

        {isCreatingJob && (
          <form onSubmit={handleCreateJob} className="bg-slate-900 border border-blue-500/30 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 mb-4">
            <div>
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Task Label</label>
              <input
                type="text" required value={newJob.label}
                onChange={(e) => setNewJob({...newJob, label: e.target.value})}
                placeholder="e.g., Monthly Donor Summary"
                className="w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">AI Prompt</label>
              <textarea
                required
                value={newJob.prompt}
                onChange={(e) => setNewJob({...newJob, prompt: e.target.value})}
                placeholder="e.g., Show me all donations from last month over $100"
                rows={3}
                className="w-full bg-black/40 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Schedule</label>
                  <input
                    type="text" value={newJob.schedule}
                    onChange={(e) => setNewJob({...newJob, schedule: e.target.value})}
                    placeholder="09:00 AM"
                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-2 text-[10px] text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Frequency</label>
                  <select
                    value={newJob.frequency}
                    onChange={(e) => setNewJob({...newJob, frequency: e.target.value})}
                    className="w-full bg-black/40 border border-slate-800 rounded-lg px-2 py-2 text-[10px] text-white focus:outline-none"
                  >
                    <option value="HOURLY">HOURLY</option>
                    <option value="DAILY">DAILY</option>
                    <option value="WEEKLY">WEEKLY</option>
                  </select>
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20">
              Schedule AI Task
            </button>
          </form>
        )}

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Scheduled Tasks</h3>
          {jobs.map(job => (
            <div key={job.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl group hover:border-blue-500/30 transition-all shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                  {job.isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] shrink-0" title="Active (scheduled)"></span>
                  )}
                  <p className="text-sm font-semibold text-slate-200 truncate">{job.label}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleDeleteJob(job.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all" title="Delete task">
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleManualRun(job.id, job.label)} className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-all shadow-lg" disabled={status !== 'idle'} title="Run manually">
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-2 italic line-clamp-2">{job.prompt.slice(0, 80)}{job.prompt.length > 80 ? '...' : ''}</p>
              <div className="flex items-center text-[10px] text-slate-500 mt-2 space-x-4">
                <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {formatScheduleTime(job.schedule)}</span>
                <span className="text-blue-400/60 font-bold tracking-tighter">{job.frequency}</span>
              </div>
              {job.lastRunAt && (
                <div className="text-[9px] text-slate-600 mt-2">
                  Last: {new Date(job.lastRunAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* 2. Main Center Section */}
      <main className={`
        ${activeMobileTab === 'ai' ? 'flex' : 'hidden lg:flex'} 
        flex-grow flex-col relative overflow-hidden h-full bg-black/10
      `}>
        
        {/* Header */}
        <header className="h-24 border-b border-slate-800 flex items-center px-10 justify-between bg-[#0F172A]/40 backdrop-blur-md z-20 shrink-0">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className={`absolute -inset-1 rounded-full opacity-50 blur-sm ${
                status === 'thinking' ? 'bg-blue-500 animate-pulse' : status === 'working' ? 'bg-emerald-500 animate-pulse' : 'bg-transparent'
              }`}></div>
              <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center border-2 border-slate-800 shadow-2xl transition-all duration-500 ${
                status === 'idle' ? 'bg-blue-600/10' : status === 'thinking' ? 'bg-blue-600 animate-spin' : 'bg-emerald-500'
              }`}>
                {status === 'idle' && <BrainCircuit className="w-7 h-7 text-blue-500" />}
                {status === 'thinking' && <Sparkles className="w-7 h-7 text-white" />}
                {status === 'working' && <Cpu className="w-7 h-7 text-white animate-bounce" />}
              </div>
            </div>
            <div>
              <h2 className="text-white font-black text-xl tracking-tight uppercase italic underline decoration-blue-500/50 decoration-4">
                {status === 'idle' ? 'Kernel Ready' : status === 'thinking' ? 'Reasoning...' : 'Executing...'}
              </h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center mt-1">
                <span className={`w-1.5 h-1.5 rounded-full mr-2 ${status === 'idle' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-blue-400 animate-pulse'}`}></span>
                Subledger Monitor Active
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <div className="bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-[9px] font-black text-slate-500 uppercase block tracking-tighter">API_STATUS</span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Stable</span>
            </div>
            <div
              className="bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer relative group"
              title={qbStatus.lastSyncAt ? `Last sync: ${new Date(qbStatus.lastSyncAt).toLocaleString()}` : 'No sync data'}
            >
              <span className="text-[9px] font-black text-slate-500 uppercase block tracking-tighter">QUICKBOOKS</span>
              <div className="flex items-center space-x-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  qbStatus.connected
                    ? 'bg-emerald-500 shadow-[0_0_8px_#22c55e]'
                    : 'bg-orange-500 animate-pulse'
                }`}></span>
                <span className={`text-xs font-bold uppercase tracking-widest ${
                  qbStatus.connected ? 'text-emerald-400' : 'text-orange-400'
                }`}>
                  {qbStatus.connected ? 'Connected' : 'Offline'}
                </span>
              </div>
              <div className="absolute top-full right-0 mt-0 pt-2 bg-slate-900 border border-slate-700 rounded-xl px-4 pb-4 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto w-64 z-50">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Status:</span>
                    <span className={qbStatus.connected ? 'text-emerald-400' : 'text-orange-400'}>
                      {qbStatus.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  {qbStatus.lastSyncAt && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Last Sync:</span>
                      <span className="text-white text-[10px]">{new Date(qbStatus.lastSyncAt).toLocaleString()}</span>
                    </div>
                  )}
                  {qbStatus.error && (
                    <div className="text-xs text-red-400 mt-2">{qbStatus.error}</div>
                  )}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-800">
                    {!qbStatus.connected ? (
                      <a
                        href="/api/quickbooks/connect"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors text-center"
                      >
                        Connect QB
                      </a>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/quickbooks/sync', { method: 'POST', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } });
                            const data = await res.json();
                            alert(`Synced ${data.transactionCount} transactions`);
                            fetchData();
                          } catch (err) {
                            alert('Sync failed');
                          }
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors"
                      >
                        Sync Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* AI Assistant status box */}
            <div
              className="bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer relative group"
              title={aiSettings ? `${aiSettings.provider} · ${aiSettings.model}` : 'Using shared key'}
            >
              <span className="text-[9px] font-black text-slate-500 uppercase block tracking-tighter">AI_AGENT</span>
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                  {aiSettings
                    ? aiSettings.provider === 'anthropic' ? 'Claude'
                      : aiSettings.provider === 'openai' ? 'OpenAI'
                      : 'Gemini'
                    : 'Shared'}
                </span>
              </div>
              {/* Hover tooltip */}
              <div className="absolute top-full right-0 mt-0 pt-2 bg-slate-900 border border-slate-700 rounded-xl px-4 pb-4 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto w-64 z-50">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Provider:</span>
                    <span className="text-white capitalize">{aiSettings?.provider ?? 'Shared (app key)'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Model:</span>
                    <span className="text-white text-[10px] font-mono">{aiSettings?.model ?? 'Default'}</span>
                  </div>
                  {aiSettings && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Key:</span>
                      <span className="text-slate-400 font-mono text-[10px]">{aiSettings.maskedKey}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-800">
                    <Link href="/settings" className="text-blue-400 hover:text-blue-300 text-xs">
                      Change in Settings →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {userName && (
              <span className="text-xs text-slate-400 px-2">
                Signed in as <span className="text-slate-200 font-medium">{userName}</span>
              </span>
            )}
            <Link
              href="/settings"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/sign-in');
              }}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Chat Feed */}
        <div ref={chatRef} className="flex-grow overflow-y-auto p-10 space-y-10 custom-scrollbar scroll-smooth relative z-10">
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
          </div>

          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
              <div className="flex flex-col items-center text-slate-800 space-y-4 opacity-30">
                <Bot className="w-16 h-16" />
                <p className="text-xs font-black uppercase tracking-[0.4em]">Listening_for_kernel_prompts...</p>
              </div>
              {!qbStatus.connected && (
                <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-4 max-w-sm text-center space-y-3">
                  <p className="text-amber-400 text-sm font-medium">QuickBooks not connected</p>
                  <p className="text-slate-500 text-xs">Connect QuickBooks so the AI can read your financial data.</p>
                  <Link
                    href="/settings"
                    className="block bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all"
                  >
                    Connect in Settings
                  </Link>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center mb-4">
              <AlertCircle className="w-4 h-4 mr-2" /> {error}
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={msg.id || `msg-${index}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className={`flex max-w-[80%] lg:max-w-[65%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row'} space-x-5`}>
                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black border shadow-2xl ${
                  msg.role === 'user' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-blue-600 text-white border-blue-500 shadow-blue-900/20'
                }`}>
                  {msg.role === 'user' ? 'ME' : 'AI'}
                </div>
                <div className={`p-6 rounded-[2.5rem] leading-relaxed text-sm shadow-2xl ${
                  msg.role === 'user'
                  ? 'bg-blue-600/10 border border-blue-500/20 text-white rounded-tr-none'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'
                }`}>
                  <MarkdownMessage content={msg.content} role={msg.role} />
                </div>
              </div>
            </div>
          ))}

          {status !== 'idle' && (
            <div className="flex justify-start">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] rounded-tl-none flex space-x-2 items-center shadow-2xl">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-10 z-20 shrink-0">
          <div className="max-w-3xl mx-auto relative group">
            <div className="absolute inset-0 bg-blue-600/20 rounded-[2rem] blur-2xl group-focus-within:bg-blue-600/40 transition-all opacity-0 group-focus-within:opacity-100"></div>
            <form onSubmit={handleSendMessage} className="relative flex items-center bg-[#1E293B] border border-slate-700 rounded-[2.2rem] px-8 py-5 shadow-2xl focus-within:border-blue-500/50 transition-all">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-2 text-slate-600 hover:text-blue-500 transition-colors disabled:opacity-50 mr-3"
                title="Upload CSV/Excel file"
              >
                <Paperclip className={`w-5 h-5 ${uploadingFile ? 'animate-spin' : ''}`} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              <input
                type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)}
                placeholder={isTyping ? "Assistant is processing..." : "Initialize system query..."}
                disabled={isTyping}
                className="flex-grow bg-transparent border-none text-sm text-white font-mono focus:outline-none placeholder:text-slate-600"
              />
              <button type="submit" disabled={!userInput.trim() || isTyping} className="text-blue-500 hover:text-blue-400 disabled:opacity-20 transition-all">
                <Send className="w-6 h-6" />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* 3. Output Section */}
      <section className={`
        ${activeMobileTab === 'output' ? 'flex' : 'hidden lg:flex'} 
        w-full lg:w-96 bg-[#020617] border-l border-slate-800 flex flex-col p-6 overflow-hidden shrink-0 h-full
      `}>
        <div className="flex items-center space-x-2 text-white mb-8 px-2 uppercase tracking-widest font-black text-lg">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <span>Diagnostic_Logs</span>
        </div>

        <div className="flex-grow overflow-y-auto space-y-6 custom-scrollbar pr-2">
          {history.map(exe => (
            <div key={exe.id} className="space-y-2 animate-in slide-in-from-right-4">
              <div className={`flex items-center space-x-2 text-[9px] font-black uppercase tracking-widest ${
                exe.status === 'completed' ? 'text-emerald-500' : 'text-orange-500'
              }`}>
                {exe.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                <span>{exe.status}</span>
                <span className="text-slate-700">|</span>
                <span className="text-slate-500">{new Date(exe.startedAt).toLocaleTimeString()}</span>
              </div>
              <div className="bg-white/5 border border-white/5 p-4 rounded-2xl border-l-2 border-l-emerald-500/50">
                <p className="text-[10px] font-black text-white uppercase mb-1">{exe.job.label}</p>
                <p className="text-slate-400 text-[10px] leading-relaxed font-mono opacity-80">{exe.result}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0F172A] border-t border-slate-800 flex items-center justify-around px-2 shrink-0 z-[100] shadow-2xl">
        <TabButton active={activeMobileTab === 'queue'} onClick={() => setActiveTab('queue')} icon={<Layers className="w-5 h-5" />} label="Queue" />
        <TabButton active={activeMobileTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<BrainCircuit className="w-5 h-5" />} label="Assistant" />
        <TabButton active={activeMobileTab === 'output'} onClick={() => setActiveTab('output')} icon={<Terminal className="w-5 h-5" />} label="Output" />
      </nav>
      <div className="lg:hidden h-16 shrink-0"></div>

    </div>
  );
}

function formatScheduleTime(schedule: string): string {
  // Already has AM/PM — return as-is
  if (/AM|PM/i.test(schedule)) return schedule;
  // Convert 24-hour "HH:MM" to 12-hour AM/PM
  const match = schedule.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return schedule;
  let hour = parseInt(match[1]);
  const min = match[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${min} ${period}`;
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center space-y-1 w-20 transition-all ${active ? 'text-blue-500' : 'text-slate-500'}`}>
      {icon}<span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}