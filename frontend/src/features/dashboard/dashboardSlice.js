import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchKPIs = createAsyncThunk('dashboard/kpis', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/dashboard/kpis');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchRecentActivity = createAsyncThunk('dashboard/activity', async (limit = 10, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/dashboard/activity', { params: { limit } });
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchSalesChart = createAsyncThunk('dashboard/salesChart', async (period = 'month', { rejectWithValue }) => {
  try {
    const { data } = await api.get('/dashboard/sales-chart', { params: { period } });
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchTopDealers = createAsyncThunk('dashboard/topDealers', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/dashboard/top-dealers');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    kpis: null,
    activity: [],
    salesChart: [],
    topDealers: [],
    loading: false,
    chartPeriod: 'month',
  },
  reducers: {
    setChartPeriod: (state, action) => { state.chartPeriod = action.payload; },
    updateKPIs: (state, action) => { state.kpis = action.payload; }, // from socket
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchKPIs.pending, (state) => { state.loading = true; })
      .addCase(fetchKPIs.fulfilled, (state, action) => { state.loading = false; state.kpis = action.payload; })
      .addCase(fetchKPIs.rejected, (state) => { state.loading = false; })
      .addCase(fetchRecentActivity.fulfilled, (state, action) => { state.activity = action.payload; })
      .addCase(fetchSalesChart.fulfilled, (state, action) => { state.salesChart = action.payload; })
      .addCase(fetchTopDealers.fulfilled, (state, action) => { state.topDealers = action.payload; });
  },
});

export const { setChartPeriod, updateKPIs } = dashboardSlice.actions;
export default dashboardSlice.reducer;
