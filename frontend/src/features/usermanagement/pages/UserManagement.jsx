import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createUser, getUsers, updateUser } from '../userSlice';
import { getRoles } from '../roleSlice';

const UserManagementPage = () => {
  const dispatch = useDispatch();

  const { users } = useSelector((s) => s.users);
  const { roles } = useSelector((s) => s.roles);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
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
      role: '',
    });
    setEditingId(null);
  };

  const handleEdit = (user) => {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role?._id || user.role,
    });

    setEditingId(user._id);
  };

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

          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value })
            }
            className="border p-2"
          >
            <option value="">Select Role</option>

            {roles.map((r) => (
              <option key={r._id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>

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
                Role: {u.role?.name || u.role}
              </p>
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