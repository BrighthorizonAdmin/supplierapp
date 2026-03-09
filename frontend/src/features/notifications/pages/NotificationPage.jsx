import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSettings, saveSettings } from '../settingsSlice';

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
      checked ? 'bg-blue-600' : 'bg-slate-200'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const TABS = [
  'General Dealer & Onboarding Settings',
  'Credit & Financial Defaults',
  'Order & Pricing controls',
  'Territory & Access rules',
];

const DEFAULT_SETTINGS = {
  defaultStatus: 'active', autoApprove: true, multipleUsers: true,
  dealerIdFormat: 'auto', defaultDealerType: 'distributor',
  gstCertificate: true, panCard: true, bankDetails: true, addressProof: true, manualApproval: true,
  defaultCreditLimit: '10000', defaultCreditPeriod: 'net30', allowPrePaid: false,
  autoBlockOnBreach: true, gracePeriod: '3',
  minOrderValue: '10000', paymentMethods: ['cash', 'card', 'upi'], allowPartialOrders: false,
  allowBackorders: '6', maxBackorderDays: '3', defaultPriceTier: 'tier1', dealerOrderOverride: true,
};

const NotificationPage = () => {
  const dispatch = useDispatch();
  const { data: savedSettings, loading, saving } = useSelector((s) => s.settings);
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => { dispatch(fetchSettings()); }, [dispatch]);

  useEffect(() => {
    if (savedSettings) setSettings((prev) => ({ ...prev, ...savedSettings }));
  }, [savedSettings]);

  const set = (key, val) => setSettings((s) => ({ ...s, [key]: val }));
  const handleSave = () => { dispatch(saveSettings(settings)); };
  const handleCancel = () => {
    setSettings(savedSettings ? { ...DEFAULT_SETTINGS, ...savedSettings } : DEFAULT_SETTINGS);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dealer Management Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure default rules and global settings for all dealers</p>
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-4 flex items-center overflow-x-auto">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>{tab}</button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 0 && (
            <div className="grid grid-cols-2 gap-10">
              <div>
                <h3 className="font-semibold text-slate-800 mb-5">General Dealer Settings</h3>
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-600">Default Dealer Status</label>
                    <select value={settings.defaultStatus} onChange={(e) => set('defaultStatus', e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36">
                      <option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-600">Auto approve new Dealers</label>
                    <Toggle checked={settings.autoApprove} onChange={(v) => set('autoApprove', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-600">Allow multiple users per Dealers</label>
                    <Toggle checked={settings.multipleUsers} onChange={(v) => set('multipleUsers', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-600">Dealer ID format</label>
                    <select value={settings.dealerIdFormat} onChange={(e) => set('dealerIdFormat', e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48">
                      <option value="auto">Auto | Enter code Prefix</option><option value="manual">Manual</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-600">Default Dealer Type</label>
                    <select value={settings.defaultDealerType} onChange={(e) => set('defaultDealerType', e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36">
                      <option value="distributor">Distributor</option><option value="retailer">Retailer</option><option value="wholesaler">Wholesaler</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Onboarding Settings</h3>
                <p className="text-xs font-semibold text-slate-500 mb-4">Mandatory Documents</p>
                <div className="space-y-4">
                  {[['GST Certificate','gstCertificate'],['PAN Card','panCard'],['Bank Details','bankDetails'],['Address Proof','addressProof']].map(([label, key]) => (
                    <div key={key} className="flex items-center justify-between">
                      <label className="text-sm text-slate-600">{label}</label>
                      <Toggle checked={settings[key]} onChange={(v) => set(key, v)} />
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">Manual Approval Required</label>
                      <Toggle checked={settings.manualApproval} onChange={(v) => set('manualApproval', v)} />
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-600 mb-0.5">Require minimum 3 or 4 Docs for Approval</p>
                      <p className="text-xs text-slate-400">Dealers must satisfy minimum required requirements.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <div className="max-w-lg">
              <h3 className="font-semibold text-slate-800 mb-6">Credit & Financial Defaults</h3>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Default Credit limit</label>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden w-36">
                    <span className="px-3 py-1.5 text-sm text-slate-500 bg-slate-50 border-r border-slate-200">₹</span>
                    <input type="number" value={settings.defaultCreditLimit} onChange={(e) => set('defaultCreditLimit', e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm focus:outline-none w-0" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Default Credit Period</label>
                  <select value={settings.defaultCreditPeriod} onChange={(e) => set('defaultCreditPeriod', e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36">
                    <option value="net15">Net 15 days</option><option value="net30">Net 30 days</option>
                    <option value="net45">Net 45 days</option><option value="net60">Net 60 days</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Allow PrePaid Dealers</label>
                  <Toggle checked={settings.allowPrePaid} onChange={(v) => set('allowPrePaid', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Auto - Block Orders on Credit Breach</label>
                  <Toggle checked={settings.autoBlockOnBreach} onChange={(v) => set('autoBlockOnBreach', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Grace Period ( Before Auto- Block )</label>
                  <select value={settings.gracePeriod} onChange={(e) => set('gracePeriod', e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36">
                    {['1','2','3','5','7','14'].map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div className="max-w-lg">
              <h3 className="font-semibold text-slate-800 mb-6">Order & Pricing controls</h3>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Minimum Order Value</label>
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden w-36">
                    <span className="px-3 py-1.5 text-sm text-slate-500 bg-slate-50 border-r border-slate-200">₹</span>
                    <input type="number" value={settings.minOrderValue} onChange={(e) => set('minOrderValue', e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm focus:outline-none w-0" />
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <label className="text-sm text-slate-600 pt-0.5">Payment Methods</label>
                  <div className="flex flex-col gap-2">
                    {[{value:'cash',label:'Cash'},{value:'card',label:'Card'},{value:'upi',label:'UPI'},{value:'bank-transfer',label:'Bank Transfer'},{value:'credit',label:'Credit'}].map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input type="checkbox"
                          checked={(settings.paymentMethods || []).includes(value)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...(settings.paymentMethods || []), value]
                              : (settings.paymentMethods || []).filter((m) => m !== value);
                            set('paymentMethods', updated);
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Allow Partial Orders</label>
                  <Toggle checked={settings.allowPartialOrders} onChange={(v) => set('allowPartialOrders', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Allow Backorders</label>
                  <select value={settings.allowBackorders} onChange={(e) => set('allowBackorders', e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36">
                    {['3','6','7','14','30'].map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Maximum Backorder Days</label>
                  <select value={settings.maxBackorderDays} onChange={(e) => set('maxBackorderDays', e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36">
                    {['1','2','3','5','7','14'].map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Default Price Tier</label>
                  <select value={settings.defaultPriceTier} onChange={(e) => set('defaultPriceTier', e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36">
                    <option value="tier1">Tier 1</option><option value="tier2">Tier 2</option><option value="tier3">Tier 3</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600">Dealer-Specific order override</label>
                  <Toggle checked={settings.dealerOrderOverride} onChange={(v) => set('dealerOrderOverride', v)} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 3 && (
            <p className="text-sm text-slate-400 py-10 text-center">Territory & Access rules — coming soon</p>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
          {/* <button onClick={handleCancel} disabled={saving} className="btn-secondary">Cancel</button> */}
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

       {/* Footer note */}
      <p className="text-center text-xs text-slate-400 pt-2">
        Role-based access &bull; Supplier&apos;s View
      </p>
    </div>
  );
};

export default NotificationPage;
