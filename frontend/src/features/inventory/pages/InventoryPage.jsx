import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchInventory, fetchWarehouses } from '../inventorySlice';
import Table from '../../../components/ui/Table';
import Pagination from '../../../components/ui/Pagination';
import { AlertTriangle } from 'lucide-react';

const InventoryPage = () => {
  const dispatch = useDispatch();
  const { list, warehouses, pagination, loading } = useSelector((s) => s.inventory);
  const [page, setPage] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStock, setLowStock] = useState(false);

  useEffect(() => { dispatch(fetchWarehouses()); }, [dispatch]);
  useEffect(() => {
    dispatch(fetchInventory({ page, limit: 20, warehouseId, lowStock: lowStock ? 'true' : '' }));
  }, [dispatch, page, warehouseId, lowStock]);

  const columns = [
    { key: 'productId', label: 'Product', render: (v) => v?.name || '—' },
    { key: 'productId', label: 'Code', render: (v) => <span className="font-mono text-xs">{v?.productCode || '—'}</span> },
    { key: 'warehouseId', label: 'Warehouse', render: (v) => v?.name || '—' },
    { key: 'quantityOnHand', label: 'On Hand', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'quantityAllocated', label: 'Allocated' },
    {
      key: 'quantityAvailable',
      label: 'Available',
      render: (v, row) => (
        <span className={v <= row.reorderLevel ? 'text-red-600 font-bold' : 'text-green-600 font-medium'}>{v}</span>
      ),
    },
    { key: 'reorderLevel', label: 'Reorder Level' },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) =>
        row.quantityAvailable <= row.reorderLevel ? (
          <span className="badge-red flex items-center gap-1 w-fit"><AlertTriangle size={12} /> Low Stock</span>
        ) : (
          <span className="badge-green">OK</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
      </div>
      <div className="card p-4 flex flex-wrap gap-3">
        <select className="input w-48" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
          Low Stock Only
        </label>
      </div>
      <div className="card">
        <Table columns={columns} data={list} loading={loading} />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default InventoryPage;
