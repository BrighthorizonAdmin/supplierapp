import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchWarrantyRequests = createAsyncThunk(
  'warranty/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/warranty-requests', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const fetchWarrantyById = createAsyncThunk(
  'warranty/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/warranty-requests/${id}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const lookupBySerial = createAsyncThunk(
  'warranty/lookupBySerial',
  async (serial, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/dispatched-units/lookup', { params: { serial } });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'No product found for this serial number');
    }
  }
);

export const updateWarrantyStatus = createAsyncThunk(
  'warranty/updateStatus',
  async ({ id, status, supplierNotes }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/warranty-requests/${id}/status`, { status, supplierNotes });
      toast.success(`Warranty request marked as ${status}`);
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const warrantySlice = createSlice({
  name: 'warranty',
  initialState: {
    list:          [],
    selected:      null,
    pagination:    null,
    loading:       false,
    error:         null,
    lookupResult:  null,
    lookupLoading: false,
    lookupError:   null,
  },
  reducers: {
    clearSelectedWarranty: (state) => { state.selected = null; },
    clearLookupResult: (state) => { state.lookupResult = null; state.lookupError = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWarrantyRequests.pending,   (state) => { state.loading = true; })
      .addCase(fetchWarrantyRequests.fulfilled, (state, action) => {
        state.loading    = false;
        state.list       = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchWarrantyRequests.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchWarrantyById.pending,   (state) => { state.loading = true; })
      .addCase(fetchWarrantyById.fulfilled, (state, action) => {
        state.loading  = false;
        state.selected = action.payload;
      })
      .addCase(fetchWarrantyById.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(lookupBySerial.pending,   (state) => { state.lookupLoading = true; state.lookupError = null; state.lookupResult = null; })
      .addCase(lookupBySerial.fulfilled, (state, action) => { state.lookupLoading = false; state.lookupResult = action.payload; })
      .addCase(lookupBySerial.rejected,  (state, action) => { state.lookupLoading = false; state.lookupError = action.payload; })

      .addCase(updateWarrantyStatus.fulfilled, (state, action) => {
        // Merge only scalar fields — preserve the populated dealerId object already in selected
        if (state.selected && state.selected._id === action.payload._id) {
          state.selected = { ...state.selected, ...action.payload, dealerId: state.selected.dealerId };
        }
        const idx = state.list.findIndex((w) => w._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { clearSelectedWarranty, clearLookupResult } = warrantySlice.actions;
export default warrantySlice.reducer;
