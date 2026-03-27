import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

const storedUser = localStorage.getItem('user');
const storedToken = localStorage.getItem('token');

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', credentials);
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('user', JSON.stringify(data.data.user));
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const getMe = createAsyncThunk('auth/getMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/me');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const storedPermissions = localStorage.getItem('permissions');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken || null,
    isAuthenticated: !!storedToken,
    loading: false,
    error: null,
    permissions: storedPermissions ? JSON.parse(storedPermissions) : null,
    isFirstLogin: false,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('permissions');
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
  state.loading = false;

  const { user, permissions, isFirstLogin } = action.payload;

  state.user = user;
  state.token = action.payload.token;
  state.isAuthenticated = true;
  state.permissions = permissions;
  state.isFirstLogin = isFirstLogin; // ✅ IMPORTANT
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('permissions', JSON.stringify(permissions));

  toast.success('Welcome back!');
})
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getMe.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.permissions = action.payload.permissions; // 🔥 IMPORTANT

        localStorage.setItem('user', JSON.stringify(action.payload.user));
        localStorage.setItem('permissions', JSON.stringify(action.payload.permissions));
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
