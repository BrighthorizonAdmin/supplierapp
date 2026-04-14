import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

// ── Payments ──────────────────────────────────────────────────────────────────

export const fetchPayments = createAsyncThunk('payment/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/payments', { params });
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

// ── Invoices ──────────────────────────────────────────────────────────────────

export const fetchInvoices = createAsyncThunk('payment/fetchInvoices', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/invoices', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchInvoiceById = createAsyncThunk('payment/fetchInvoiceById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/invoices/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createInvoice = createAsyncThunk('payment/createInvoice', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/invoices', body);
    toast.success('Invoice created!');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to create invoice');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const updateInvoice = createAsyncThunk('payment/updateInvoice', async ({ id, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/invoices/${id}`, body);
    toast.success('Invoice updated!');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to update invoice');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const issueInvoice = createAsyncThunk('payment/issueInvoice', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/invoices/${id}/issue`);
    toast.success('Invoice issued!');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to issue invoice');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const cancelInvoice = createAsyncThunk('payment/cancelInvoice', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/invoices/${id}/cancel`);
    toast.success('Invoice cancelled');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to cancel invoice');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const deleteInvoice = createAsyncThunk('payment/deleteInvoice', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/invoices/${id}`);
    toast.success('Invoice deleted');
    return id;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to delete invoice');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchSettings = createAsyncThunk('payment/fetchSettings', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/settings');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const paymentSlice = createSlice({
  name: 'payment',
  initialState: {
    list: [],
    invoices: [],
    selected: null,
    selectedInvoice: null,
    pagination: null,
    invoicePagination: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearSelected: (state) => { state.selected = null; },
    clearSelectedInvoice: (state) => { state.selectedInvoice = null; },
  },
  extraReducers: (builder) => {
    builder
      // Payments
      .addCase(fetchPayments.pending,    (state) => { state.loading = true; })
      .addCase(fetchPayments.fulfilled,  (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchPayments.rejected,   (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createPayment.fulfilled,  (state, action) => { state.list.unshift(action.payload); })
      .addCase(confirmPayment.fulfilled, (state, action) => {
        const idx = state.list.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })

      // Invoices
      .addCase(fetchInvoices.pending,       (state) => { state.loading = true; })
      .addCase(fetchInvoices.fulfilled,     (state, action) => {
        state.loading = false;
        state.invoices = action.payload.data;
        state.invoicePagination = action.payload.pagination;
      })
      .addCase(fetchInvoices.rejected,      (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchInvoiceById.pending,    (state) => { state.loading = true; })
      .addCase(fetchInvoiceById.fulfilled,  (state, action) => {
        state.loading = false;
        state.selectedInvoice = action.payload;
      })
      .addCase(fetchInvoiceById.rejected,   (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createInvoice.fulfilled,     (state, action) => { state.invoices.unshift(action.payload); })
      .addCase(updateInvoice.fulfilled,     (state, action) => {
        const i = state.invoices.findIndex((x) => x._id === action.payload._id);
        if (i !== -1) state.invoices[i] = action.payload;
        state.selectedInvoice = action.payload;
      })
      .addCase(issueInvoice.fulfilled,      (state, action) => {
        const i = state.invoices.findIndex((x) => x._id === action.payload._id);
        if (i !== -1) state.invoices[i] = action.payload;
        if (state.selectedInvoice?._id === action.payload._id) state.selectedInvoice = action.payload;
      })
      .addCase(cancelInvoice.fulfilled,     (state, action) => {
        const i = state.invoices.findIndex((x) => x._id === action.payload._id);
        if (i !== -1) state.invoices[i] = action.payload;
        if (state.selectedInvoice?._id === action.payload._id) state.selectedInvoice = action.payload;
      })
      .addCase(deleteInvoice.fulfilled,     (state, action) => {
        state.invoices = state.invoices.filter((x) => x._id !== action.payload);
      });
  },
});

export const { clearSelected, clearSelectedInvoice } = paymentSlice.actions;
export default paymentSlice.reducer;