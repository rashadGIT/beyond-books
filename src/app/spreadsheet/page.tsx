'use client';

import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Table2,
  CheckCircle2,
  AlertCircle,
  Layers,
  X,
  FileUp,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { AppNav } from '@/components/AppNav';

type Tab = 'export' | 'templates' | 'import';
type ExportDataType = 'invoices' | 'payments' | 'sales_receipts';
type ImportEntityType = 'invoices' | 'customers' | 'vendors' | 'products' | 'chart_of_accounts';
type FileFormat = 'xlsx' | 'csv';

interface ImportResult {
  created: number;
  skipped: number;
  total: number;
  errors: { row: number; reason: string }[];
}

const EXPORT_TYPES: { value: ExportDataType; label: string; description: string }[] = [
  { value: 'invoices', label: 'Invoices', description: 'Invoice #, Customer, Date, Due Date, Total, Balance, Status' },
  { value: 'payments', label: 'Payments', description: 'Payment #, Customer, Date, Amount, Method' },
  { value: 'sales_receipts', label: 'Sales Receipts', description: 'Receipt #, Customer/Donor, Date, Amount, Description' },
];

const IMPORT_TYPES: { value: ImportEntityType; label: string; requiredFields: string }[] = [
  { value: 'invoices', label: 'Invoices', requiredFields: 'CustomerName, ItemName, UnitPrice (required)' },
  { value: 'customers', label: 'Customers', requiredFields: 'DisplayName (required)' },
  { value: 'vendors', label: 'Vendors', requiredFields: 'DisplayName (required)' },
  { value: 'products', label: 'Products / Services', requiredFields: 'Name (required)' },
  { value: 'chart_of_accounts', label: 'Chart of Accounts', requiredFields: 'Name, AccountType (required)' },
];

export default function SpreadsheetPage() {
  const [activeTab, setActiveTab] = useState<Tab>('export');

  // Export state
  const [exportType, setExportType] = useState<ExportDataType>('invoices');
  const [exportFormat, setExportFormat] = useState<FileFormat>('xlsx');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Template state
  const [templateType, setTemplateType] = useState<ImportEntityType>('invoices');
  const [templateFormat, setTemplateFormat] = useState<FileFormat>('xlsx');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Import state
  const [importType, setImportType] = useState<ImportEntityType>('invoices');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ fileId: string; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const body: Record<string, string> = { dataType: exportType, format: exportFormat };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;

      const res = await fetch('/api/spreadsheet/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');

      setExportSuccess(`Exported ${data.recordCount} record(s). `);
      // Trigger download
      window.open(data.downloadUrl, '_blank');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // ─── Template ──────────────────────────────────────────────────────────────
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setTemplateError(null);
    try {
      const res = await fetch(
        `/api/spreadsheet/template?type=${templateType}&format=${templateFormat}`,
        { redirect: 'manual' }
      );
      // The route redirects to a presigned URL
      const location = res.headers.get('location') || res.url;
      if (location && location !== window.location.href) {
        window.open(location, '_blank');
      } else if (res.ok) {
        // Fallback: try to get URL from JSON body
        const data = await res.json().catch(() => null);
        if (data?.downloadUrl) window.open(data.downloadUrl, '_blank');
        else throw new Error('Could not retrieve download URL');
      } else {
        throw new Error('Template download failed');
      }
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'Template download failed');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // ─── Import File Upload ────────────────────────────────────────────────────
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setImportError(null);
    setImportResult(null);
    setUploadedFile(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/spreadsheet/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadedFile({ fileId: data.fileId, filename: data.filename });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!uploadedFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch('/api/spreadsheet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: importType, fileId: uploadedFile.fileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const clearImport = () => {
    setUploadedFile(null);
    setImportResult(null);
    setImportError(null);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans">
      {/* Top Nav */}
      <header className="h-16 bg-[#0F172A] border-b border-slate-800 flex items-center px-6 gap-4 z-20">
        <div className="flex items-center gap-2 text-white">
          <div className="bg-emerald-600 p-1 rounded-lg">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm tracking-tight uppercase tracking-widest">Spreadsheet Sync</span>
        </div>
        <div className="ml-auto">
          <AppNav />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Page Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-white tracking-tight">Spreadsheet Sync</h1>
          <p className="text-slate-500 text-sm">Export QB data to spreadsheets, download import templates, or push bulk data back into QuickBooks.</p>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-1">
          <TabBtn active={activeTab === 'export'} onClick={() => setActiveTab('export')} icon={<Download className="w-4 h-4" />} label="Export" />
          <TabBtn active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} icon={<Table2 className="w-4 h-4" />} label="Templates" />
          <TabBtn active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={<Upload className="w-4 h-4" />} label="Import" />
        </div>

        {/* ── Export Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'export' && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-white font-bold text-lg">Export QuickBooks Data</h2>
              <p className="text-slate-500 text-xs">Pull live QB data into a downloadable spreadsheet file.</p>
            </div>

            {/* Data Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Data Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {EXPORT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setExportType(t.value)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      exportType === t.value
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="font-semibold text-sm mb-1">{t.label}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Start Date (optional)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">End Date (optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-black/40 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 transition-colors"
                />
              </div>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">File Format</label>
              <div className="flex gap-2">
                <FormatButton active={exportFormat === 'xlsx'} onClick={() => setExportFormat('xlsx')} label="Excel (.xlsx)" />
                <FormatButton active={exportFormat === 'csv'} onClick={() => setExportFormat('csv')} label="CSV (.csv)" />
              </div>
            </div>

            {/* Feedback */}
            {exportError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{exportError}
              </div>
            )}
            {exportSuccess && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />{exportSuccess}Download started in new tab.
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-900/20 text-sm"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exporting...' : `Export ${EXPORT_TYPES.find(t => t.value === exportType)?.label} to ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        )}

        {/* ── Templates Tab ───────────────────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-white font-bold text-lg">Import Templates</h2>
              <p className="text-slate-500 text-xs">Download a pre-formatted template, fill it in, then use the Import tab to push data into QuickBooks.</p>
            </div>

            {/* Entity Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Entity Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {IMPORT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTemplateType(t.value)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      templateType === t.value
                        ? 'border-blue-500/60 bg-blue-500/10 text-white'
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="font-semibold text-sm mb-1">{t.label}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{t.requiredFields}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">File Format</label>
              <div className="flex gap-2">
                <FormatButton active={templateFormat === 'xlsx'} onClick={() => setTemplateFormat('xlsx')} label="Excel (.xlsx)" />
                <FormatButton active={templateFormat === 'csv'} onClick={() => setTemplateFormat('csv')} label="CSV (.csv)" />
              </div>
            </div>

            {/* How to use */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-2">
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">How to use</p>
              <ol className="text-slate-400 text-xs space-y-1.5">
                {[
                  'Download the template for your entity type below.',
                  'Fill in your data — required fields are marked in the template.',
                  'Go to the Import tab, upload your filled file, and click Import.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {templateError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />{templateError}
              </div>
            )}

            <button
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-900/20 text-sm"
            >
              <Download className="w-4 h-4" />
              {downloadingTemplate ? 'Generating...' : `Download ${IMPORT_TYPES.find(t => t.value === templateType)?.label} Template`}
            </button>
          </div>
        )}

        {/* ── Import Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="space-y-1">
                <h2 className="text-white font-bold text-lg">Import to QuickBooks</h2>
                <p className="text-slate-500 text-xs">Upload a filled spreadsheet and push the rows as new records into QuickBooks.</p>
              </div>

              {/* Entity Type */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">What are you importing?</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {IMPORT_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setImportType(t.value)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        importType === t.value
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                          : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <p className="font-semibold text-sm">{t.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t.requiredFields}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop Zone */}
              {!uploadedFile && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-900/30 hover:border-slate-600 hover:bg-slate-900/50'
                  } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
                  />
                  <FileUp className={`w-10 h-10 mx-auto mb-3 ${dragOver ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <p className="text-slate-400 text-sm font-semibold">
                    {uploading ? 'Uploading...' : 'Drop your file here or click to browse'}
                  </p>
                  <p className="text-slate-600 text-xs mt-1">Accepts .xlsx, .xls, .csv</p>
                </div>
              )}

              {/* Uploaded File Indicator */}
              {uploadedFile && !importResult && (
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                  <Layers className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-emerald-400 text-sm font-semibold truncate">{uploadedFile.filename}</p>
                    <p className="text-slate-500 text-xs">Ready to import</p>
                  </div>
                  <button onClick={clearImport} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Import Error */}
              {importError && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />{importError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                {uploadedFile && !importResult && (
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-900/20 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    {importing ? 'Importing...' : `Import ${IMPORT_TYPES.find(t => t.value === importType)?.label} to QB`}
                  </button>
                )}
                {importResult && (
                  <button
                    onClick={clearImport}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all text-sm"
                  >
                    <FileUp className="w-4 h-4" />
                    Import Another File
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('templates')}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-semibold py-3 px-4 transition-colors"
                >
                  Need a template? <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Import Results */}
            {importResult && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-white font-bold">Import Results</h3>

                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Created"
                    value={importResult.created}
                    color="emerald"
                  />
                  <StatCard
                    label="Skipped"
                    value={importResult.skipped}
                    color={importResult.skipped > 0 ? 'orange' : 'slate'}
                  />
                  <StatCard
                    label="Total Rows"
                    value={importResult.total}
                    color="slate"
                  />
                </div>

                {importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Skipped Rows</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="flex items-start gap-3 text-xs bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                          <span className="text-red-400 font-bold shrink-0">Row {e.row}</span>
                          <span className="text-slate-400">{e.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.created === importResult.total && importResult.total > 0 && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    All {importResult.total} row(s) imported successfully!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
        active
          ? 'bg-white/10 text-white shadow-inner'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function FormatButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-all ${
        active
          ? 'border-blue-500/60 bg-blue-500/10 text-white'
          : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'emerald' | 'orange' | 'slate' }) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    slate: 'text-slate-300 bg-slate-800/50 border-slate-700',
  };
  return (
    <div className={`border rounded-xl p-4 text-center ${colors[color]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">{label}</p>
    </div>
  );
}
