import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

/* ───────────────────────────── thunks ───────────────────────────── */

export const fetchLedger = createAsyncThunk('ledger/fetch', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/ledger', { params });
    return data; // { data: [groups], summary, pagination }
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchOrderLedger = createAsyncThunk('ledger/fetchOrder', async (orderId, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/ledger/order/${orderId}`);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const addManualPayment = createAsyncThunk(
  'ledger/addManualPayment',
  async ({ orderId, form }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, v);
      });
      const { data } = await api.post(`/ledger/order/${orderId}/payment`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Payment recorded');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteManualPayment = createAsyncThunk(
  'ledger/deleteManualPayment',
  async ({ orderId, paymentId }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`/ledger/order/${orderId}/payment/${paymentId}`);
      toast.success('Payment entry removed');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove entry');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const patchLedgerEntry = createAsyncThunk(
  'ledger/patchEntry',
  async ({ orderId, body }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/ledger/order/${orderId}`, body);
      toast.success('Ledger updated');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const uploadScreenshot = createAsyncThunk(
  'ledger/uploadScreenshot',
  async ({ orderId, file, label }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append('screenshot', file);
      if (label) fd.append('label', label);
      const { data } = await api.post(`/ledger/order/${orderId}/screenshot`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Screenshot added');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

export const deleteScreenshot = createAsyncThunk(
  'ledger/deleteScreenshot',
  async ({ orderId, screenshotId }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`/ledger/order/${orderId}/screenshot/${screenshotId}`);
      toast.success('Screenshot removed');
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

const notifyToast = (r) => {
  const bits = [];
  if (r.app) bits.push(r.app.ok ? 'app ✓' : 'app ✗');
  if (r.email) bits.push(r.email.ok ? 'email ✓' : `email ✗ (${r.email.error || 'failed'})`);
  toast.success(`Notified ${r.dealerName} — ${bits.join(', ')}`);
};

export const notifyDealer = createAsyncThunk(
  'ledger/notify',
  async ({ dealerId, channel, orderIds }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/ledger/notify', { dealerId, channel, orderIds });
      notifyToast(data.data);
      return data.data;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Notify failed');
      return rejectWithValue(err.response?.data?.message);
    }
  }
);

// The export is requested with responseType:'blob', so an error body ({ message })
// arrives as a Blob too — read it back so the user sees the server's real reason
// (e.g. "Nothing to export for the given selection") instead of a generic failure.
const exportErrorMessage = async (err) => {
  try {
    const body = err.response?.data;
    if (body instanceof Blob) return JSON.parse(await body.text()).message || 'Download failed';
  } catch {
    // body wasn't JSON — fall through
  }
  return err.response?.data?.message || 'Download failed';
};

/* Download helper (not a thunk — streams a file) */
export const downloadLedger = async ({ scope = 'all', format = 'csv', dealerId, orderId, ...rest }) => {
  try {
    const res = await api.get('/ledger/export', {
      params: { scope, format, dealerId, orderId, ...rest },
      responseType: 'blob',
    });
    const cd = res.headers['content-disposition'] || '';
    const match = cd.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `ledger_${scope}.${format}`;
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(await exportErrorMessage(err));
  }
};

/* ───────────────────────────── slice ───────────────────────────── */

const applyDetail = (state, row) => {
  if (!row) return;
  state.detail = row;

  // Views that list settled orders (Cleared / All transactions) keep the row and
  // just update it in place; only the Outstanding list drops it.
  if (row.settled && !state.showsSettled) {
    // Fully paid off — the main list excludes settled orders, so drop it from
    // the still-open group too instead of leaving a stale ₹0 row on screen
    // until the modal closes and triggers a full refetch.
    state.groups = state.groups
      .map((g) => {
        if (String(g.dealerId) !== String(row.dealerId)) return g;
        const removed = g.orders.find((o) => String(o.orderId) === String(row.orderId));
        if (!removed) return g;
        const orders = g.orders.filter((o) => String(o.orderId) !== String(row.orderId));
        return orders.length
          ? {
              ...g,
              orders,
              orderCount: orders.length,
              totalOutstanding: +Math.max(0, g.totalOutstanding - removed.outstanding).toFixed(2),
              pendingCount: removed.status === 'pending' ? g.pendingCount - 1 : g.pendingCount,
              partialCount: removed.status === 'partial' ? g.partialCount - 1 : g.partialCount,
              overdueCount: removed.overdue ? g.overdueCount - 1 : g.overdueCount,
            }
          : null;
      })
      .filter(Boolean);
    return;
  }

  state.groups = state.groups.map((g) => {
    if (String(g.dealerId) !== String(row.dealerId)) return g;
    return { ...g, orders: g.orders.map((o) => (String(o.orderId) === String(row.orderId) ? row : o)) };
  });
};

const ledgerSlice = createSlice({
  name: 'ledger',
  initialState: {
    groups: [],
    summary: null,
    pagination: null,
    showsSettled: false, // true when the loaded list includes fully-paid orders
    detail: null,
    loading: false,
    detailLoading: false,
    error: null,
  },
  reducers: {
    clearDetail: (state) => { state.detail = null; },
  },
  extraReducers: (builder) => {
    const detailPending = (state) => { state.detailLoading = true; };
    const detailDone = (state, { payload }) => { state.detailLoading = false; applyDetail(state, payload); };
    const detailFail = (state) => { state.detailLoading = false; };

    builder
      .addCase(fetchLedger.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchLedger.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchLedger.fulfilled, (state, { payload, meta }) => {
        state.loading = false;
        state.showsSettled = !!meta.arg?.includeSettled || meta.arg?.status === 'cleared';
        state.groups = payload.data || [];
        state.summary = payload.summary || null;
        state.pagination = payload.pagination || null;
      })
      .addCase(fetchOrderLedger.pending, detailPending)
      .addCase(fetchOrderLedger.fulfilled, detailDone)
      .addCase(fetchOrderLedger.rejected, detailFail)
      .addCase(addManualPayment.fulfilled, detailDone)
      .addCase(deleteManualPayment.fulfilled, detailDone)
      .addCase(patchLedgerEntry.fulfilled, detailDone)
      .addCase(uploadScreenshot.fulfilled, detailDone)
      .addCase(deleteScreenshot.fulfilled, detailDone);
  },
});

export const { clearDetail } = ledgerSlice.actions;
export default ledgerSlice.reducer;
