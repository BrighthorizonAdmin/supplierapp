import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../../../services/api';


const InventoryDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchDetails = async () => {
      try {
        // Get inventory data from navigation state
        const inventoryData = location.state?.inventory;
        if (!inventoryData) {
          throw new Error('No inventory data provided');
        }

        // Fetch only serials for this product
        const prodId = (inventoryData.productId && inventoryData.productId._id) 
          ? inventoryData.productId._id 
          : inventoryData.productId;
        
        let serials = [];
        if (prodId) {
          const response = await api.get(`/dispatched-units/All-Serials?productId=${prodId}`);
          const units = response.data?.data || [];
          serials = units.map((u) => ({
            serialNumber: u.serialNumber,
            dispatchedAt: u.dispatchedAt,
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
        if (mounted) {
          setError(err.message || err.response?.data?.message || 'Failed to load inventory details');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDetails();
    return () => { mounted = false; };
  }, [id, location.state]);

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
  console.log(gstRate, prod.taxRate, prod);
  const showOnline = prod.showOnline ? 'Yes' : 'No';

  const formatValue = (value) => {
    if (value == null || value === '') return '—';
    if (typeof value === 'number') return `₹${value.toLocaleString('en-IN')}`;
    return value;
  };

  const formatDateOrDash = (value) => (value ? format(new Date(value), 'dd MMM yyyy') : '—');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50">
            Back
          </button>
        </div>
        {/* <h2 className="text-xl font-semibold text-slate-900">Inventory Details</h2> */}
        <div />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-medium font-medium text-slate-700 tracking-[0.2em]">General Details</p>
            </div>
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

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-medium font-medium text-slate-700 tracking-[0.2em]">Pricing Details</p>
            </div>
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
                <p className="font-medium text-slate-800">{prod.hsn || prod.hsnCode || '—'}</p>
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <p className="text-medium font-medium text-slate-700 tracking-[0.2em]">Serial Numbers</p>
          </div>
          {/* <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                disabled
                placeholder="Search"
                className="input w-52 py-2 text-sm border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
            <button className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50">
              Report
            </button>
          </div> */}
        </div>

        {data.serials && data.serials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Serial Number</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Created</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice Number</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.serials.map((serial, index) => (
                  <tr key={serial.serialNumber || index} className="hover:bg-slate-50">
                    <td className="px-4 py-4 font-mono text-slate-800">{serial.serialNumber || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDateOrDash(serial.dispatchedAt)}</td>
                    <td className="px-4 py-4 text-slate-600 font-mono">
                      {serial.invoiceId?.invoiceNumber || serial.invoiceNumber || serial.invoiceId || '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
                        {serial.status ? serial.status.replace(/_/g, ' ') : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">No serials registered</div>
        )}
      </div>
    </div>
  );
};

export default InventoryDetailsPage;
