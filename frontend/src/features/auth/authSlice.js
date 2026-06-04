import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { setAuthToken } from '../../services/api';
import toast from 'react-hot-toast';

const storedToken = sessionStorage.getItem('token');
const storedUser  = sessionStorage.getItem('user');

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', credentials);
    setAuthToken(data.data.token);
    sessionStorage.setItem('user', JSON.stringify(data.data.user));
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const getMe = createAsyncThunk('auth/getRoles', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/auth/getRoles');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const storedPermissions = sessionStorage.getItem('permissions');

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
      setAuthToken(null);
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('permissions');
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
  state.loading = false;

  const { user, permissions, isFirstLogin, lowStockCount, outOfStockCount } = action.payload;

  state.user = user;
  state.token = action.payload.token;
  state.isAuthenticated = true;
  state.permissions = permissions;
  state.isFirstLogin = isFirstLogin;
  sessionStorage.setItem('user', JSON.stringify(user));
  sessionStorage.setItem('permissions', JSON.stringify(permissions));

  toast.success('Welcome back!');

  const total = (lowStockCount || 0) + (outOfStockCount || 0);
  if (total > 0) {
    const parts = [];
    if (lowStockCount > 0) parts.push(`${lowStockCount} low-stock`);
    if (outOfStockCount > 0) parts.push(`${outOfStockCount} out-of-stock`);
    toast(`⚠️ ${parts.join(' and ')} product${total !== 1 ? 's' : ''} need attention!`, {
      duration: 8000,
      style: { background: '#f59e0b', color: '#fff', fontWeight: '600' },
    });
  }
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
