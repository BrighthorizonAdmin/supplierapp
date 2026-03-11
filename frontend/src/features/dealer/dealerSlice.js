import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchDealers = createAsyncThunk('dealer/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/dealers', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchDealerById = createAsyncThunk('dealer/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/dealers/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createDealer = createAsyncThunk('dealer/create', async (dealerData, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/dealers', dealerData);
    toast.success('Dealer created successfully');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const approveDealer = createAsyncThunk('dealer/approve', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/dealers/${id}/approve`, body);
    toast.success('Dealer approved successfully');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const rejectDealer = createAsyncThunk('dealer/reject', async ({ id, reason }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/dealers/${id}/reject`, { reason });
    toast.success('Dealer rejected');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const suspendDealer = createAsyncThunk('dealer/suspend', async ({ id, reason }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/dealers/${id}/suspend`, { reason });
    toast.success('Dealer suspended');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateDealer = createAsyncThunk('dealer/update', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/dealers/${id}`, body);
    toast.success('Dealer updated successfully');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchDealerStats = createAsyncThunk('dealer/stats', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/dealers/${id}/stats`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const dealerSlice = createSlice({
  name: 'dealer',
  initialState: {
    list: [],
    selected: null,
    stats: null,
    pagination: null,
    loading: false,
    error: null,
    filters: { status: '', businessType: '', search: '' },
  },
  reducers: {
    setFilters: (state, action) => { state.filters = { ...state.filters, ...action.payload }; },
    clearSelected: (state) => { state.selected = null; state.stats = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDealers.pending, (state) => { state.loading = true; })
      .addCase(fetchDealers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchDealers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchDealerById.fulfilled, (state, action) => { state.selected = action.payload; })
      .addCase(fetchDealerStats.fulfilled, (state, action) => { state.stats = action.payload; })
      .addCase(approveDealer.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(rejectDealer.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(suspendDealer.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateDealer.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      });
  },
});

export const { setFilters, clearSelected } = dealerSlice.actions;
export default dealerSlice.reducer;
