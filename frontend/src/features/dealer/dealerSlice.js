import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchDealers = createAsyncThunk('dealer/fetchAll', async (params, { rejectWithValue, signal }) => {
  try {
    const { data } = await api.get('/dealers', { params, signal });
    return { ...data, _fetchedStatus: params?.status ?? '' };
  } catch (err) {
    if (err.name === 'CanceledError' || err.name === 'AbortError') return rejectWithValue('aborted');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchDealerCounts = createAsyncThunk('dealer/fetchCounts', async (_, { rejectWithValue }) => {
  try {
    const [tot, act, pnd, sus] = await Promise.all([
      api.get('/dealers', { params: { limit: 1 } }),
      api.get('/dealers', { params: { limit: 1, status: 'active' } }),
      api.get('/dealers', { params: { limit: 1, status: 'pending' } }),
      api.get('/dealers', { params: { limit: 1, status: 'suspended' } }),
    ]);
    return {
      total: tot.data.pagination?.total ?? 0,
      active: act.data.pagination?.total ?? 0,
      pending: pnd.data.pagination?.total ?? 0,
      suspended: sus.data.pagination?.total ?? 0,
    };
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

export const requestDealerUpdate = createAsyncThunk(
  'dealer/requestUpdate',
  async ({ id, field, fields, updateFields, instructions }, { rejectWithValue }) => {
    try {
      // Normalise to array — support legacy single field and new multi-field
      const resolvedFields = updateFields || fields || (field ? [field] : []);
      const { data } = await api.patch(`/dealers/${id}/request-update`, {
        fields:       resolvedFields,
        updateFields: resolvedFields,
        instructions,
      });
      toast.success('Update request sent to dealer');
      return data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

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
    counts: { total: 0, active: 0, pending: 0, suspended: 0 },
    countsFetched: false,
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
        // Derive count for this status from pagination so stats stay fresh without extra calls
        const total = action.payload.pagination?.total ?? 0;
        const s = action.payload._fetchedStatus;
        if (s === '') state.counts.total = total;
        else if (s === 'active') state.counts.active = total;
        else if (s === 'pending') state.counts.pending = total;
        else if (s === 'suspended') state.counts.suspended = total;
      })
      .addCase(fetchDealers.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchDealerCounts.fulfilled, (state, action) => {
        state.counts = action.payload;
        state.countsFetched = true;
      })
      .addCase(fetchDealerById.fulfilled, (state, action) => { state.selected = action.payload; })
      .addCase(fetchDealerStats.fulfilled, (state, action) => { state.stats = action.payload; })
      .addCase(approveDealer.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
        state.counts.pending = Math.max(0, state.counts.pending - 1);
        state.counts.active += 1;
      })
      .addCase(rejectDealer.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        state.counts.pending = Math.max(0, state.counts.pending - 1);
      })
      .addCase(requestDealerUpdate.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
        state.counts.pending = Math.max(0, state.counts.pending - 1);
      })
      .addCase(suspendDealer.fulfilled, (state, action) => {
        const idx = state.list.findIndex((d) => d._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        state.counts.active = Math.max(0, state.counts.active - 1);
        state.counts.suspended += 1;
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