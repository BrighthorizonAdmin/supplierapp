import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createUser, getUsers, resetUserPassword, updateUser } from '../userSlice';
import { getRoles } from '../roleSlice';
import Select from 'react-select';


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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        User Management
      </h1>

      <div className="border p-4 rounded mb-6">

        <div className="grid grid-cols-2 gap-3">

          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            className="border p-2"
          />

          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
            className="border p-2"
          />

          {!editingId && (
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              className="border p-2"
            />
          )}

          <Select
            options={roleOptions}
            isMulti
            placeholder="Select Roles..."
            className="w-full"
            classNamePrefix="select"
            value={roleOptions.filter(option =>
              form.role.includes(option.value)
            )}
            onChange={(selectedOptions) => {
              const values = selectedOptions.map(opt => opt.value);
              setForm({ ...form, role: values });
            }}
          />

        </div>

        <button
          onClick={handleSubmit}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          {editingId ? 'Update User' : 'Create User'}
        </button>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Users</h2>

        {users.map((u) => (
          <div
            key={u._id}
            className="border p-3 mb-2 flex justify-between"
          >
            <div>
              <p className="font-semibold">{u.name}</p>
              <p className="text-sm">{u.email}</p>
              <p className="text-xs text-blue-600">
                Role: {Array.isArray(u.role) ? u.role.join(", ") : u.role}
              </p>
              <button
                onClick={() => handleReset(u._id)}
                className="bg-red-500 text-white px-2 py-1"
              >
                Reset Password
              </button>
            </div>


            <button
              onClick={() => handleEdit(u)}
              className="text-blue-600"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserManagementPage;