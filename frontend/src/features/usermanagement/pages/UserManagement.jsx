import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createUser, getUsers, resetUserPassword, updateUser } from '../userSlice';
import { getRoles } from '../roleSlice';
import Select from 'react-select';
import { KeyRound, Pencil, Save, UserPlus, Users } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import SectionCard from '../../../components/ui/SectionCard';
import { getInitials } from '../../../components/layout/userDisplay';
import { SELECT_STYLES } from '../../../components/ui/selectStyles';


const UserManagementPage = () => {
  const dispatch = useDispatch();

  const { users } = useSelector((s) => s.users);
  const { roles } = useSelector((s) => s.roles);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: [],
  });

  const [editingId, setEditingId] = useState(null);


  useEffect(() => {
    dispatch(getUsers());
    dispatch(getRoles());
  }, [dispatch]);

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.role) {
      return alert('All fields required');
    }

    if (editingId) {
      dispatch(updateUser({ id: editingId, payload: form }));
    } else {
      dispatch(createUser(form));
    }

    setForm({
      name: '',
      email: '',
      password: '',
      role: [],
    });
    setEditingId(null);
  };

  const handleEdit = (user) => {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: Array.isArray(user.role) ? user.role : [user.role].filter(Boolean),
    });

    setEditingId(user._id);
  };

  const handleReset = (id) => {
    const newPassword = prompt('Enter new password');
    if (!newPassword) return;

    dispatch(resetUserPassword({ id, password: newPassword }));
  };

  const roleOptions = roles.map((r) => ({
    value: r.name,
    label: r.name,
  }));

  const cancelEdit = () => {
    setForm({ name: '', email: '', password: '', role: [] });
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="User management"
        subtitle={`${users.length} ${users.length === 1 ? 'person has' : 'people have'} access to the supplier portal`}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          title={editingId ? 'Edit user' : 'Create user'}
          subtitle={editingId ? 'Update details and roles' : 'Give a team member portal access'}
          className="h-fit"
        >
          <div className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                placeholder="e.g. Priya Sharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {!editingId && (
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Temporary password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label">Roles</label>
              <Select
                options={roleOptions}
                isMulti
                placeholder="Select roles…"
                classNamePrefix="select"
                styles={SELECT_STYLES}
                value={roleOptions.filter((option) => form.role.includes(option.value))}
                onChange={(selectedOptions) => {
                  const values = selectedOptions.map((opt) => opt.value);
                  setForm({ ...form, role: values });
                }}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSubmit} className="btn-primary flex-1">
                {editingId ? <><Save size={15} /> Update user</> : <><UserPlus size={15} /> Create user</>}
              </button>
              {editingId && (
                <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Users" subtitle="Everyone with a portal login" className="xl:col-span-2" flush>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-5">User</th>
                  <th>Roles</th>
                  <th className="pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr className="hover:bg-transparent">
                    <td colSpan={3} className="py-12 text-center text-sm text-slate-400">No users yet</td>
                  </tr>
                ) : users.map((u) => {
                  const roles = Array.isArray(u.role) ? u.role : [u.role].filter(Boolean);
                  return (
                    <tr key={u._id} className={editingId === u._id ? 'bg-primary-50/50' : ''}>
                      <td className="pl-5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                            {getInitials(u.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{u.name}</p>
                            <p className="truncate text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {roles.map((r) => <span key={r} className="badge-blue">{r}</span>)}
                        </div>
                      </td>
                      <td className="pr-5">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(u)} className="btn-secondary px-3 py-1.5">
                            <Pencil size={14} /> Edit
                          </button>
                          <button onClick={() => handleReset(u._id)} className="btn-ghost px-3 py-1.5 text-red-600 hover:bg-red-50 hover:text-red-700">
                            <KeyRound size={14} /> Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default UserManagementPage;