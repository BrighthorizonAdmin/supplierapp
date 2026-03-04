import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchInventory = createAsyncThunk('inventory/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/inventory', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchInventoryStats = createAsyncThunk('inventory/fetchStats', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/inventory/stats');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchWarehouses = createAsyncThunk('inventory/warehouses', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/warehouses');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const adjustStock = createAsyncThunk('inventory/adjust', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/inventory/adjust', body);
    toast.success('Stock adjusted successfully');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createWarehouse = createAsyncThunk('inventory/createWarehouse', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/warehouses', body);
    toast.success('Warehouse created');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const inventorySlice = createSlice({
  name: 'inventory',
  initialState: {
    list:       [],
    warehouses: [],
    stats:      null,
    statsLoading: false,
    pagination: null,
    loading:    false,
    error:      null,
    filters:    { warehouseId: '', lowStock: false },
  },
  reducers: {
    setFilters: (state, action) => { state.filters = { ...state.filters, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending,  (state) => { state.loading = true; })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading    = false;
        state.list       = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchInventory.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchInventoryStats.pending,  (state) => { state.statsLoading = true; })
      .addCase(fetchInventoryStats.fulfilled, (state, action) => { state.statsLoading = false; state.stats = action.payload; })
      .addCase(fetchInventoryStats.rejected,  (state) => { state.statsLoading = false; })
      .addCase(fetchWarehouses.fulfilled,    (state, action) => { state.warehouses = action.payload; })
      .addCase(createWarehouse.fulfilled,    (state, action) => { state.warehouses.push(action.payload); });
  },
});

export const { setFilters } = inventorySlice.actions;
export default inventorySlice.reducer;
