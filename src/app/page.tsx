'use client';

import React, { useState } from 'react';
import { processExcel, parseCustomerList, mergeCustomerData } from '@/lib/parser';
import { StandardizedTransaction, CustomerContact, BrandingConfig } from '@/lib/types';
import { Upload, FileText, CheckCircle2, AlertCircle, Users, Mail, DollarSign, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function POCDashboard() {
  const router = useRouter();
  const [customerList, setCustomerList] = useState<CustomerContact[]>([]);
  const [salesData, setSalesData] = useState<StandardizedTransaction[]>([]);
  const [mergedData, setMergedData] = useState<StandardizedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingConfig>({
    organizationName: 'Youth Revive Inc.',
    tagline: 'Building stronger communities together',
    taxId: '840-464680632',
    signerName: 'Brandie',
    signerTitle: 'Executive Director',
    primaryColor: '#2563eb',
  });
  const [showBrandingModal, setShowBrandingModal] = useState(false);

  const handleCustomerListUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const customers = await parseCustomerList(file);
      setCustomerList(customers);
      setError(null);

      // If we already have sales data, merge them
      if (salesData.length > 0) {
        const merged = mergeCustomerData(salesData, customers);
        setMergedData(merged);
        localStorage.setItem('last_processed_data', JSON.stringify(merged));
        localStorage.setItem('branding_config', JSON.stringify(branding));
      }
    } catch (err: any) {
      setError('Error processing Customer List: ' + err.message);
    }
  };

  const handleSalesDataUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await processExcel(file);
      if (result.source === 'Unknown') {
        setError('Could not detect file format. Please check the sample files.');
        setSalesData([]);
        setMergedData([]);
      } else {
        setSalesData(result.transactions);
        setError(null);

        // If we already have customer list, merge them
        if (customerList.length > 0) {
          const merged = mergeCustomerData(result.transactions, customerList);
          setMergedData(merged);
          localStorage.setItem('last_processed_data', JSON.stringify(merged));
          localStorage.setItem('branding_config', JSON.stringify(branding));
        } else {
          // No customer list yet, just use sales data
          setMergedData(result.transactions);
          localStorage.setItem('last_processed_data', JSON.stringify(result.transactions));
          localStorage.setItem('branding_config', JSON.stringify(branding));
        }
      }
    } catch (err: any) {
      setError('Error processing Sales Summary: ' + err.message);
    }
  };

  const handleGenerateLetters = () => {
    localStorage.setItem('branding_config', JSON.stringify(branding));
    router.push('/letters');
  };

  const handleBrandingUpdate = (newBranding: BrandingConfig) => {
    setBranding(newBranding);
    localStorage.setItem('branding_config', JSON.stringify(newBranding));
    setShowBrandingModal(false);
  };

  const totalGross = mergedData.reduce((sum, tx) => sum + tx.grossAmount, 0);
  const totalFees = mergedData.reduce((sum, tx) => sum + tx.fee, 0);
  const totalNet = mergedData.reduce((sum, tx) => sum + tx.netAmount, 0);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Donation Letter Generator</h1>
            <p className="text-slate-500">Phase 1: Upload QuickBooks data and generate IRS-compliant donation letters</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowBrandingModal(true)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl flex items-center hover:bg-slate-50 transition-colors shadow-sm font-medium"
            >
              <Settings className="w-4 h-4 mr-2" /> Customize Branding
            </button>
            {mergedData.length > 0 && (
              <button
                onClick={handleGenerateLetters}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl flex items-center hover:bg-blue-700 transition-colors shadow-md font-medium"
              >
                <Mail className="w-4 h-4 mr-2" /> Generate Letters
              </button>
            )}
          </div>
        </div>

        {/* Upload Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Customer Contact List Upload */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="cursor-pointer group">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`p-4 rounded-full group-hover:bg-green-100 transition-colors ${customerList.length > 0 ? 'bg-green-100' : 'bg-green-50'}`}>
                  {customerList.length > 0 ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  ) : (
                    <Users className="w-8 h-8 text-green-600" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-slate-700">
                    {customerList.length > 0 ? `${customerList.length} Customers Loaded` : 'Customer Contact List'}
                  </p>
                  <p className="text-sm text-slate-400">Upload QuickBooks Customer List (.xlsx)</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleCustomerListUpload}
                />
              </div>
            </label>
          </div>

          {/* Sales Summary Upload */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <label className="cursor-pointer group">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`p-4 rounded-full group-hover:bg-blue-100 transition-colors ${salesData.length > 0 ? 'bg-blue-100' : 'bg-blue-50'}`}>
                  {salesData.length > 0 ? (
                    <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  ) : (
                    <DollarSign className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-slate-700">
                    {salesData.length > 0 ? `${salesData.length} Donations Loaded` : 'Sales by Customer Summary'}
                  </p>
                  <p className="text-sm text-slate-400">Upload QuickBooks Sales Summary (.xlsx)</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleSalesDataUpload}
                />
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {mergedData.length > 0 && (
          <>
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center text-slate-500 mb-2">
                  <Users className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium uppercase tracking-wider">Customers</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{customerList.length}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center text-slate-500 mb-2">
                  <DollarSign className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium uppercase tracking-wider">Total Donations</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center text-slate-500 mb-2">
                  <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
                  <span className="text-sm font-medium uppercase tracking-wider">Total Fees</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">${Math.abs(totalFees).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-green-500">
                <div className="flex items-center text-slate-500 mb-2">
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                  <span className="text-sm font-medium uppercase tracking-wider">Net Amount</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-bottom border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mergedData.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{tx.donorName}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{tx.donorEmail || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {tx.originalData?.customerContact?.phone || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">
                          ${tx.grossAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {mergedData.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">Upload files to get started</p>
            <p className="text-sm">Start by uploading either Customer List or Sales Summary</p>
          </div>
        )}
      </div>

      {/* Branding Modal */}
      {showBrandingModal && (
        <BrandingModal
          branding={branding}
          onSave={handleBrandingUpdate}
          onClose={() => setShowBrandingModal(false)}
        />
      )}
    </main>
  );
}

function BrandingModal({
  branding,
  onSave,
  onClose,
}: {
  branding: BrandingConfig;
  onSave: (config: BrandingConfig) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState(branding);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(config);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Customize Branding</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={config.organizationName}
                onChange={(e) => setConfig({ ...config, organizationName: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tagline
              </label>
              <input
                type="text"
                value={config.tagline}
                onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tax ID (EIN)
              </label>
              <input
                type="text"
                value={config.taxId}
                onChange={(e) => setConfig({ ...config, taxId: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="XX-XXXXXXX"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Signer Name
                </label>
                <input
                  type="text"
                  value={config.signerName}
                  onChange={(e) => setConfig({ ...config, signerName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Signer Title
                </label>
                <input
                  type="text"
                  value={config.signerTitle}
                  onChange={(e) => setConfig({ ...config, signerTitle: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Primary Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="h-10 w-20 rounded border border-slate-300"
                />
                <input
                  type="text"
                  value={config.primaryColor}
                  onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="#2563eb"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
