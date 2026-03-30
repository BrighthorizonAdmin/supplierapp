import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createRole, deleteRole, getPermissions, getRoles, updateRole } from '../roleSlice';
import { useEffect } from 'react';


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

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Role & Permission Management
      </h1>

      <div className="border p-4 rounded mb-6">

        <h2 className="font-semibold mb-3">
          {editingId ? 'Edit Role' : 'Create Role'}
        </h2>

        <input
          placeholder="Role Name (admin / custom)"
          value={form.name}
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
          className="border p-2 w-full mb-2"
        />

        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) =>
            setForm({ ...form, description: e.target.value })
          }
          className="border p-2 w-full mb-4"
        />

        <h3 className="font-semibold mb-2">
          Assign Permissions
        </h3>

        {Object.entries(groupedPerms).map(([group, perms]) => (
          <div key={group} className="mb-3 border p-3 rounded">

            <div className="flex justify-between mb-2">
              <h4 className="font-medium">{group}</h4>

              <button
                onClick={() => toggleGroup(perms)}
                className="text-sm text-blue-600"
              >
                Select All
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {perms.map((p) => (
                <label key={p.key} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(p.key)}
                    onChange={() => togglePermission(p.key)}
                  />
                  {p.label}
                </label>
              ))}
            </div>

          </div>
        ))}

        <button
          onClick={handleSubmit}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          {editingId ? 'Update Role' : 'Create Role'}
        </button>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Existing Roles</h2>

        {roles.map((r) => (
          <div
            key={r._id}
            className="border p-3 mb-2 flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-sm text-gray-500">
                {r.description}
              </p>
            </div>

            <div className="flex gap-3">

              <button
                onClick={() => handleEdit(r)}
                className="text-blue-600"
              >
                Edit
              </button>

              {!r.isSystem && (
                <button
                  onClick={() => handleDelete(r)}
                  className="text-red-600"
                >
                  Delete
                </button>
              )}

            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default RoleManagementPage;
