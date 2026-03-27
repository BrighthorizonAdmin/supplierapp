import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";
import toast from "react-hot-toast";

// Get all permissions (registry)
export const getPermissions = createAsyncThunk(
  'roles/getPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/roles/permissions');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Get roles
export const getRoles = createAsyncThunk(
  'roles/getRoles',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/roles');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Create role
export const createRole = createAsyncThunk(
  'roles/createRole',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/roles', payload);
      toast.success('Role created');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Update role
export const updateRole = createAsyncThunk(
  'roles/updateRole',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/roles/${id}`, payload);
      toast.success('Role updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// Delete role
export const deleteRole = createAsyncThunk(
  'roles/deleteRole',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/roles/${id}`);
      toast.success('Role deleted');
      return id;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);


const roleSlice = createSlice({
  name: 'roles',
  initialState: {
    roles: [],
    permissions: [],
    loading: false,
    error: null,
  },
  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(getPermissions.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPermissions.fulfilled, (state, action) => {
        state.loading = false;
        state.permissions = action.payload;
      })
      .addCase(getPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(getRoles.pending, (state) => {
        state.loading = true;
      })
      .addCase(getRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.roles = action.payload;
      })
      .addCase(getRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createRole.fulfilled, (state, action) => {
        state.roles.push(action.payload);
      })

      .addCase(updateRole.fulfilled, (state, action) => {
        const index = state.roles.findIndex(
          (r) => r._id === action.payload._id
        );
        if (index !== -1) {
          state.roles[index] = action.payload;
        }
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.roles = state.roles.filter(
          (r) => r._id !== action.payload
        );
      });
  },
});

export default roleSlice.reducer;