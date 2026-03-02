import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchRetailOrders = createAsyncThunk('retailOrder/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/retail-orders', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchRetailOrderById = createAsyncThunk('retailOrder/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/retail-orders/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createRetailOrder = createAsyncThunk('retailOrder/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/retail-orders', body);
    toast.success('Retail order created');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const retailOrderSlice = createSlice({
  name: 'retailOrder',
  initialState: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    error: null,
  },
  reducers: { clearSelected: (state) => { state.selected = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRetailOrders.pending, (state) => { state.loading = true; })
      .addCase(fetchRetailOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchRetailOrders.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchRetailOrderById.fulfilled, (state, action) => { state.selected = action.payload; })
      .addCase(createRetailOrder.fulfilled, (state, action) => { state.list.unshift(action.payload); });
  },
});

export const { clearSelected } = retailOrderSlice.actions;
export default retailOrderSlice.reducer;
