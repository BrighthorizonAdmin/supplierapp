import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchAuditLogs = createAsyncThunk('audit/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/audit', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchAnalyticsKPIs = createAsyncThunk('audit/analyticsKPIs', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/dashboard/kpis');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchAnalyticsSalesChart = createAsyncThunk('audit/analyticsSalesChart', async (period = 'year', { rejectWithValue }) => {
  try {
    const { data } = await api.get('/dashboard/sales-chart', { params: { period } });
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchAnalyticsInventoryStats = createAsyncThunk('audit/analyticsInventoryStats', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/inventory/stats');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchAnalyticsTopProducts = createAsyncThunk('audit/analyticsTopProducts', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/inventory', { params: { limit: 7 } });
    return data.data || [];
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchAnalyticsDeliveredOrders = createAsyncThunk('audit/analyticsDeliveredOrders', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/orders', { params: { status: 'delivered', limit: 1 } });
    return data.pagination?.total || 0;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchRetailAnalytics = createAsyncThunk('audit/retailAnalytics', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/retail-orders/analytics');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const auditSlice = createSlice({
  name: 'audit',
  initialState: {
    list: [], pagination: null, loading: false, error: null, filters: {},
    analyticsKPIs: null,
    analyticsSalesChart: [],
    analyticsInventoryStats: null,
    analyticsTopProducts: [],
    deliveredCount: 0,
    analyticsLoading: false,
    chartPeriod: 'year',
    retailAnalytics: null,
    retailAnalyticsLoading: false,
  },
  reducers: {
    setFilters: (state, action) => { state.filters = { ...state.filters, ...action.payload }; },
    setChartPeriod: (state, action) => { state.chartPeriod = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state) => { state.loading = true; })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchAnalyticsKPIs.pending, (state) => { state.analyticsLoading = true; })
      .addCase(fetchAnalyticsKPIs.fulfilled, (state, action) => { state.analyticsLoading = false; state.analyticsKPIs = action.payload; })
      .addCase(fetchAnalyticsKPIs.rejected, (state) => { state.analyticsLoading = false; })
      .addCase(fetchAnalyticsSalesChart.fulfilled, (state, action) => { state.analyticsSalesChart = action.payload; })
      .addCase(fetchAnalyticsInventoryStats.fulfilled, (state, action) => { state.analyticsInventoryStats = action.payload; })
      .addCase(fetchAnalyticsTopProducts.fulfilled, (state, action) => { state.analyticsTopProducts = action.payload; })
      .addCase(fetchAnalyticsDeliveredOrders.fulfilled, (state, action) => { state.deliveredCount = action.payload; })
      .addCase(fetchRetailAnalytics.pending, (state) => { state.retailAnalyticsLoading = true; })
      .addCase(fetchRetailAnalytics.fulfilled, (state, action) => { state.retailAnalyticsLoading = false; state.retailAnalytics = action.payload; })
      .addCase(fetchRetailAnalytics.rejected, (state) => { state.retailAnalyticsLoading = false; });
  },
});

export const { setFilters, setChartPeriod } = auditSlice.actions;
export default auditSlice.reducer;
