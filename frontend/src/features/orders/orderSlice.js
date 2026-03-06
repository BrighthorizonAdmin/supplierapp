import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchOrders = createAsyncThunk('order/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/orders', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchOrderById = createAsyncThunk('order/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/orders/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createOrder = createAsyncThunk('order/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/orders', body);
    toast.success('Order created');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const confirmOrder = createAsyncThunk('order/confirm', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/orders/${id}/confirm`);
    toast.success('Order confirmed successfully');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const cancelOrder = createAsyncThunk('order/cancel', async ({ id, reason }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/orders/${id}/cancel`, { reason });
    toast.success('Order cancelled');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const orderSlice = createSlice({
  name: 'order',
  initialState: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    error: null,
    filters: { status: '', dealerId: '' },
  },
  reducers: {
    setFilters: (state, action) => { state.filters = { ...state.filters, ...action.payload }; },
    clearSelected: (state) => { state.selected = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchOrders.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchOrderById.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchOrderById.fulfilled, (state, action) => { state.loading = false; state.selected = action.payload; })
      .addCase(fetchOrderById.rejected, (state, action) => { state.loading = false; state.error = action.payload; toast.error(action.payload || 'Failed to load order'); })
      .addCase(confirmOrder.fulfilled, (state, action) => {
        const idx = state.list.findIndex((o) => o._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(cancelOrder.fulfilled, (state, action) => {
        const idx = state.list.findIndex((o) => o._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      });
  },
});

export const { setFilters, clearSelected } = orderSlice.actions;
export default orderSlice.reducer;
