import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchPayments = createAsyncThunk('payment/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/payments', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchInvoices = createAsyncThunk('payment/fetchInvoices', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/invoices', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createPayment = createAsyncThunk('payment/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/payments', body);
    toast.success('Payment recorded');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const confirmPayment = createAsyncThunk('payment/confirm', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/payments/${id}/confirm`);
    toast.success('Payment confirmed');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const paymentSlice = createSlice({
  name: 'payment',
  initialState: {
    list: [],
    invoices: [],
    selected: null,
    pagination: null,
    invoicePagination: null,
    loading: false,
    error: null,
  },
  reducers: { clearSelected: (state) => { state.selected = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayments.pending, (state) => { state.loading = true; })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchPayments.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.invoices = action.payload.data;
        state.invoicePagination = action.payload.pagination;
      })
      .addCase(createPayment.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(confirmPayment.fulfilled, (state, action) => {
        const idx = state.list.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export const { clearSelected } = paymentSlice.actions;
export default paymentSlice.reducer;
