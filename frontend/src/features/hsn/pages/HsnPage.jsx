import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Tag, Plus, Check, X, Pencil } from 'lucide-react';
import { fetchHsnCategories, createHsnCategory, updateHsnCategory } from '../hsnSlice';

const HsnPage = () => {
  const dispatch = useDispatch();
  const { list, loading } = useSelector((s) => s.hsn);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHsn,  setNewHsn]  = useState('');
  const [newErr,  setNewErr]  = useState('');
  const [adding,  setAdding]  = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editHsn,   setEditHsn]   = useState('');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { dispatch(fetchHsnCategories()); }, [dispatch]);

  const handleAdd = async () => {
    setNewErr('');
    if (!newName.trim()) { setNewErr('Category name is required'); return; }
    setAdding(true);
    const res = await dispatch(createHsnCategory({ name: newName.trim(), hsnCode: newHsn.trim() }));
    setAdding(false);
    if (!res.error) { setNewName(''); setNewHsn(''); setShowAdd(false); }
  };

  const startEdit = (cat) => { setEditingId(cat._id); setEditHsn(cat.hsnCode || ''); };

  const handleUpdate = async (id) => {
    setSaving(true);
    const res = await dispatch(updateHsnCategory({ id, hsnCode: editHsn.trim() }));
    setSaving(false);
    if (!res.error) setEditingId(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">HSN Codes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage product categories and their HSN codes</p>
        </div>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add New Category
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-blue-800">New Category</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label text-xs">Category Name <span className="text-red-500">*</span></label>
              <input
                className="input"
                placeholder="e.g. Smartphones"
                value={newName}
                onChange={e => { setNewName(e.target.value); setNewErr(''); }}
              />
              {newErr && <p className="text-red-500 text-xs mt-1">{newErr}</p>}
            </div>
            <div>
              <label className="label text-xs">HSN Code</label>
              <input
                className="input"
                placeholder="e.g. 8517"
                value={newHsn}
                onChange={e => setNewHsn(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding} className="btn-primary text-sm py-1.5 px-5">
              {adding ? 'Saving...' : 'Save Category'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(''); setNewHsn(''); setNewErr(''); }}
              className="btn-secondary text-sm py-1.5 px-5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Category</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">HSN Code</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="text-center py-10 text-gray-400">Loading...</td></tr>
            )}
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-10">
                  <Tag size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No categories yet. Add one above.</p>
                </td>
              </tr>
            )}
            {list.map(cat => (
              <tr key={cat._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Tag size={13} className="text-blue-600" />
                    </div>
                    <span className="font-medium text-gray-800">{cat.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  {editingId === cat._id ? (
                    <input
                      className="input py-1.5 text-sm w-40"
                      value={editHsn}
                      onChange={e => setEditHsn(e.target.value)}
                      placeholder="e.g. 8517"
                      autoFocus
                    />
                  ) : (
                    <span className={cat.hsnCode
                      ? 'font-mono text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-xs'
                      : 'text-gray-400 italic text-xs'
                    }>
                      {cat.hsnCode || 'Not set'}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  {editingId === cat._id ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleUpdate(cat._id)}
                        disabled={saving}
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-semibold"
                      >
                        <Check size={13} /> {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(cat)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Pencil size={12} /> Edit HSN
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* {list.length > 0 && (
        <p className="text-xs text-gray-400">
          Tip: Selecting a category in the product form will auto-fill its HSN code.
        </p>
      )} */}
    </div>
  );
};

export default HsnPage;
