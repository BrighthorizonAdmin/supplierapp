import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchExchanges = createAsyncThunk('exchange/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/exchanges', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchExchangeById = createAsyncThunk('exchange/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/exchanges/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateExchangeStatus = createAsyncThunk('exchange/updateStatus', async ({ id, status, supplierNotes }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/exchanges/${id}/status`, { status, supplierNotes });
    toast.success(`Exchange ${status}`);
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to update exchange status');
    return rejectWithValue(err.response?.data?.message);
  }
});

const exchangeSlice = createSlice({
  name: 'exchange',
  initialState: { list: [], selected: null, pagination: null, loading: false, error: null },
  reducers: { clearSelected: (state) => { state.selected = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchExchanges.pending, (state) => { state.loading = true; })
      .addCase(fetchExchanges.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchExchanges.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchExchangeById.fulfilled, (state, action) => { state.selected = action.payload; })
      .addCase(updateExchangeStatus.fulfilled, (state, action) => {
        const idx = state.list.findIndex((e) => e._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      });
  },
});

export const { clearSelected } = exchangeSlice.actions;
export default exchangeSlice.reducer;
