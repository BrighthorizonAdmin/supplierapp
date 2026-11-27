import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createRole, deleteRole, getPermissions, getRoles, updateRole } from '../roleSlice';
import { useEffect } from 'react';
import { KeyRound, Pencil, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';


const RoleManagementPage = () => {
  const dispatch = useDispatch();
  const { roles, permissions } = useSelector((s) => s.roles);

  const [form, setForm] = useState({
    name: '',
    description: '',
    permissions: [],
  });

  const [editingId, setEditingId] = useState(null);
  const [groupedPerms, setGroupedPerms] = useState({});

  useEffect(() => {
    dispatch(getRoles());
    dispatch(getPermissions());
  }, [dispatch]);

  useEffect(() => {
    const grouped = permissions.reduce((acc, p) => {
      if (!acc[p.group]) acc[p.group] = [];
      acc[p.group].push(p);
      return acc;
    }, {});
    setGroupedPerms(grouped);
  }, [permissions]);

  const togglePermission = (perm) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleGroup = (groupPerms) => {
    const keys = groupPerms.map((p) => p.key);

    const allSelected = keys.every((k) =>
      form.permissions.includes(k)
    );

    setForm((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !keys.includes(p))
        : [...new Set([...prev.permissions, ...keys])],
    }));
  };

  const handleSubmit = () => {
    if (!form.name) return alert('Role name required');

    if (editingId) {
      dispatch(updateRole({ id: editingId, payload: form }));
    } else {
      dispatch(createRole(form));
    }

    setForm({
      name: '',
      description: '',
      permissions: [],
    });
    setEditingId(null);
  };

  const handleEdit = (role) => {
    setForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    });
    setEditingId(role._id);
  };

  const handleDelete = (role) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${role.name}" role?`
    );

    if (!confirmDelete) return;

    dispatch(deleteRole(role._id));
  };

  const cancelEdit = () => {
    setForm({ name: '', description: '', permissions: [] });
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={KeyRound}
        title="Role permissions"
        subtitle="Decide what each team can see and do in the portal"
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          title={editingId ? 'Edit role' : 'Create role'}
          subtitle={`${form.permissions.length} permission${form.permissions.length === 1 ? '' : 's'} selected`}
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Role name</label>
              <input
                className="input"
                placeholder="e.g. finance, warehouse-staff"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                placeholder="What this role is for"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <p className="label mt-5">Permissions</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(groupedPerms).map(([group, perms]) => {
              const selected = perms.filter((perm) => form.permissions.includes(perm.key)).length;
              const allSelected = selected === perms.length;
              return (
                <div key={group} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold capitalize text-slate-900">{group}</h4>
                      <p className="text-xs text-slate-500">{selected} of {perms.length} selected</p>
                    </div>
                    <button onClick={() => toggleGroup(perms)} className="link text-xs">
                      {allSelected ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {perms.map((perm) => (
                      <label key={perm.key} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-200"
                          checked={form.permissions.includes(perm.key)}
                          onChange={() => togglePermission(perm.key)}
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={handleSubmit} className="btn-primary">
              {editingId ? <><Save size={15} /> Update role</> : <><Plus size={15} /> Create role</>}
            </button>
            {editingId && <button onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </SectionCard>

        <SectionCard title="Existing roles" subtitle={`${roles.length} roles`} className="h-fit">
          {roles.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No roles yet</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {roles.map((r) => (
                <li key={r._id} className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 ${editingId === r._id ? 'rounded-lg bg-primary-50/50' : ''}`}>
                  <span className="icon-tile h-9 w-9 rounded-xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                    <ShieldCheck size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-semibold text-slate-900">{r.name}</p>
                      {r.isSystem && <span className="badge-gray">System</span>}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {r.description || 'No description'} · {(r.permissions || []).length} permissions
                    </p>
                  </div>
                  <button onClick={() => handleEdit(r)} className="btn-ghost p-2" title="Edit role">
                    <Pencil size={15} />
                  </button>
                  {!r.isSystem && (
                    <button onClick={() => handleDelete(r)} className="btn-ghost p-2 text-red-600 hover:bg-red-50 hover:text-red-700" title="Delete role">
                      <Trash2 size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default RoleManagementPage;
