import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchFinanceStats = createAsyncThunk('finance/stats', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/finance/stats');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchRevenueSummary = createAsyncThunk('finance/revenue', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/finance/revenue', { params });
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchDealerLedger = createAsyncThunk('finance/ledger', async ({ dealerId, ...params }, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/finance/ledger/${dealerId}`, { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchPaymentReport = createAsyncThunk('finance/paymentReport', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/finance/payments/report', { params });
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const financeSlice = createSlice({
  name: 'finance',
  initialState: {
    stats: null,
    revenue: [],
    ledger: [],
    ledgerPagination: null,
    paymentReport: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchFinanceStats.pending, (state) => { state.loading = true; })
      .addCase(fetchFinanceStats.fulfilled, (state, action) => { state.loading = false; state.stats = action.payload; })
      .addCase(fetchFinanceStats.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchRevenueSummary.fulfilled, (state, action) => { state.revenue = action.payload; })
      .addCase(fetchDealerLedger.fulfilled, (state, action) => {
        state.ledger = action.payload.data;
        state.ledgerPagination = action.payload.pagination;
      })
      .addCase(fetchPaymentReport.fulfilled, (state, action) => { state.paymentReport = action.payload; });
  },
});

export default financeSlice.reducer;
