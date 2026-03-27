import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";
import toast from "react-hot-toast";

export const getUsers = createAsyncThunk(
  'users/getUsers',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('auth/users');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('auth/users', payload);
      toast.success('User created');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`auth/users/${id}`, payload);
      toast.success('User updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const resetUserPassword = createAsyncThunk(
  'users/resetPassword',
  async ({ id, password },{rejectWithValue}) => {
    try{
      await api.patch(`auth/users/${id}/password`,{newPassword:password});
    toast.success('Password reset successfully');
    return id;
    }
    catch(err){
       toast.error(err.response?.data?.message || 'Update failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch('/auth/me/password', {
        currentPassword,
        newPassword,
      });

      toast.success(data.message || 'Password changed successfully');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Password change failed';
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState: {
    users: [],
    loading: false,
    error: null,
  },
  reducers: {},

  extraReducers: (builder) => {
    builder
      // GET
      .addCase(getUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(getUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
      })
      .addCase(getUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // CREATE
      .addCase(createUser.fulfilled, (state, action) => {
        state.users.push(action.payload);
      })

      // UPDATE
      .addCase(updateUser.fulfilled, (state, action) => {
        const index = state.users.findIndex(
          (u) => u._id === action.payload._id
        );
        if (index !== -1) {
          state.users[index] = action.payload;
        }
      });
  },
});

export default userSlice.reducer;