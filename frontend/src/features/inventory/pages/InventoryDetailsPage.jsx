import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../../services/api';

const InventoryDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = useSelector((s) => s.auth.user);
  console.log(currentUser)
  const isSuperAdmin = Array.isArray(currentUser?.role)
    ? currentUser.role.includes('super-admin')
    : currentUser?.role === 'super-admin';
console.log(isSuperAdmin)
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Soft-delete state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchDetails = async () => {
      try {
        const inventoryData = location.state?.inventory;
        if (!inventoryData) throw new Error('No inventory data provided');

        const prodId = (inventoryData.productId && inventoryData.productId._id)
          ? inventoryData.productId._id
          : inventoryData.productId;

        let serials = [];
        if (prodId) {
          const response = await api.get(`/dispatched-units/All-Serials?productId=${prodId}`);
          const units = response.data?.data || [];
          serials = units.map((u) => ({
            _id: u._id,
            serialNumber: u.serialNumber,
            dispatchedAt: u.createdAt,
            invoiceId: u.invoiceId,
            invoiceNumber: u.invoiceNumber,
            status: u.status,
          }));
        }

        if (!mounted) return;
        setData({ ...inventoryData, serials });
        setError(null);
      } catch (err) {
        console.error(err);
        if (mounted) setError(err.message || err.response?.data?.message || 'Failed to load inventory details');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDetails();
    return () => { mounted = false; };
  }, [id, location.state]);

  const toggleSelect = (serialId) => {
    setSelectedIds((prev) =>
      prev.includes(serialId) ? prev.filter((x) => x !== serialId) : [...prev, serialId]
    );
  };

  const toggleSelectAll = () => {
    const eligible = (data?.serials || []).filter((s) => s.status === 'in_stock' && s._id);
    if (selectedIds.length === eligible.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligible.map((s) => s._id));
    }
  };

  const handleSoftDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleteLoading(true);
    try {
      await api.patch('/inventory/serials/soft-delete', {
        serialIds: selectedIds,
        reason: deleteReason.trim(),
      });
      toast.success(`${selectedIds.length} serial number(s) deleted successfully`);
      // Remove deleted serials from local state
      setData((prev) => ({
        ...prev,
        serials: prev.serials.filter((s) => !selectedIds.includes(s._id)),
        currentStockQty: Math.max(0, (prev.currentStockQty || 0) - selectedIds.length),
      }));
      setSelectedIds([]);
      setDeleteReason('');
      setShowDeleteModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete serial numbers');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return <div className="p-6">No data found</div>;

  const prod = data.productId || {};
  const availableQty = Math.max(0, data.currentStockQty || 0);
  const stockValue = prod.basePrice ? prod.basePrice * availableQty : null;
  const lowStockThreshold = data.openingStockQty ? Math.floor((data.openingStockQty || 0) * 0.2) : null;
  const lowStockEnabled = lowStockThreshold != null && availableQty <= lowStockThreshold && availableQty > 0;
  const purchasePrice = prod.purchasePrice ?? prod.basePrice ?? 0;
  const gstRate = prod.taxRate != null ? `${prod.taxRate}%` : '—';
  const showOnline = prod.showOnline ? 'Yes' : 'No';

  const formatValue = (value) => {
    if (value == null || value === '') return '—';
    if (typeof value === 'number') return `₹${value.toLocaleString('en-IN')}`;
    return value;
  };

  const formatDateOrDash = (value) => (value ? format(new Date(value), 'dd MMM yyyy') : '—');

  const eligibleSerials = (data.serials || []).filter((s) => s.status === 'in_stock' && s._id);
  const allSelected = eligibleSerials.length > 0 && selectedIds.length === eligibleSerials.length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50">
            Back
          </button>
        </div>
        <div />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        {/* General Details */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-medium font-medium text-slate-700 tracking-[0.2em]">General Details</p>
          </div>
          <div className="grid gap-3">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Item Name</p>
              <p className="font-semibold text-slate-900">{prod.name || '—'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Item Code</p>
                <p className="font-medium text-slate-800">{prod.productCode || prod.sku || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Category</p>
                <p className="font-medium text-slate-800">{prod.category || '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Current Stock</p>
                <p className="font-semibold text-slate-900">{availableQty.toLocaleString('en-IN')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Stock Value</p>
                <p className="font-semibold text-slate-900">{stockValue != null ? formatValue(stockValue) : '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Low Stock Quantity</p>
                <p className="font-medium text-slate-800">{lowStockThreshold != null ? lowStockThreshold.toLocaleString('en-IN') : '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Low Stock Warning</p>
                <p className={`font-medium ${lowStockEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {lowStockEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Show in Online Store</p>
                <p className="font-medium text-slate-800">{showOnline}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Primary Unit</p>
                <p className="font-medium text-slate-800">{prod.unit ? prod.unit.toUpperCase() : '—'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Item Description</p>
              <p className="text-sm text-slate-600 leading-relaxed">{prod.description || '—'}</p>
            </div>
          </div>
        </div>

        {/* Pricing Details */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-medium font-medium text-slate-700 tracking-[0.2em]">Pricing Details</p>
          </div>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Sales Price</p>
                <p className="font-semibold text-slate-900">{formatValue(prod.basePrice)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Purchase Price</p>
                <p className="font-semibold text-slate-900">{formatValue(purchasePrice)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">GST Tax Rate</p>
                <p className="font-medium text-slate-800">{gstRate}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">HSN Code</p>
                <p className="font-medium text-slate-800">{prod.hsnCode || '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Secondary Unit</p>
                <p className="font-medium text-slate-800">{prod.secondaryUnit || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Wholesale Price</p>
                <p className="font-medium text-slate-800">{formatValue(prod.wholesalePrice)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Min. Wholesale Quantity</p>
              <p className="font-medium text-slate-800">{prod.minWholesaleQuantity != null ? prod.minWholesaleQuantity.toLocaleString('en-IN') : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Serial Numbers */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <p className="text-medium font-medium text-slate-700 tracking-[0.2em]">Serial Numbers</p>

          {isSuperAdmin && selectedIds.length > 0 && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>

        {data.serials && data.serials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {isSuperAdmin && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-red-600 cursor-pointer"
                        title="Select all in-stock serials"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Serial Number</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Created</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice Number</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.serials.map((serial, index) => {
                  const isEligible = serial.status === 'in_stock' && serial._id;
                  const isChecked = selectedIds.includes(serial._id);
                  return (
                    <tr
                      key={serial.serialNumber || index}
                      className={`hover:bg-slate-50 ${isChecked ? 'bg-red-50' : ''}`}
                    >
                      {isSuperAdmin && (
                        <td className="px-4 py-4">
                          {isEligible ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelect(serial._id)}
                              className="w-4 h-4 rounded border-slate-300 text-red-600 cursor-pointer"
                            />
                          ) : (
                            <span className="w-4 h-4 block" />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4 font-mono text-slate-800">{serial.serialNumber || '—'}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDateOrDash(serial.dispatchedAt)}</td>
                      <td className="px-4 py-4 text-slate-600 font-mono">
                        {serial.invoiceId || serial.invoiceNumber ? (
                          <button
                            onClick={() => navigate(`/invoices/${serial.invoiceId?._id || serial.invoiceId}`)}
                            className="text-blue-500 hover:text-blue-700 cursor-pointer bg-transparent border-none font-mono"
                          >
                            {serial.invoiceId?.invoiceNumber || serial.invoiceNumber || serial.invoiceId || '—'}
                          </button>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
                          {serial.status ? serial.status.replace(/_/g, ' ') : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">No serials registered</div>
        )}
      </div>

      {/* Soft Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete Serial Numbers</h3>
                <p className="text-sm text-slate-500">This action will soft-delete {selectedIds.length} serial number(s)</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600">
              Stock will be automatically reduced by <strong>{selectedIds.length}</strong> unit(s). Deleted serials can be restored later.
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. damaged unit, recall, data entry error..."
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteReason(''); }}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSoftDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLoading && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryDetailsPage;
