import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAuditLogs = createAsyncThunk('audit/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/audit', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const auditSlice = createSlice({
  name: 'audit',
  initialState: { list: [], pagination: null, loading: false, error: null, filters: {} },
  reducers: {
    setFilters: (state, action) => { state.filters = { ...state.filters, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => { state.loading = true; })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  },
});

export const { setFilters } = auditSlice.actions;
export default auditSlice.reducer;
