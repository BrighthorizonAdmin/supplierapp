import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchTickets = createAsyncThunk('support/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/support', { params });
    return res.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

export const fetchTicketById = createAsyncThunk('support/fetchById', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/support/${id}`);
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

export const updateTicketStatus = createAsyncThunk('support/updateStatus', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const res = await api.patch(`/support/${id}/status`, body);
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

const supportSlice = createSlice({
  name: 'support',
  initialState: {
    tickets: [], pagination: null, meta: null,
    current: null, loading: false, detailLoading: false, error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTickets.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(fetchTickets.fulfilled, (s, a) => {
        s.loading = false;
        s.tickets = a.payload.data;
        s.pagination = a.payload.pagination;
        s.meta = a.payload.meta;
      })
      .addCase(fetchTickets.rejected,  (s, a) => { s.loading = false; s.error = a.payload?.message; })

      .addCase(fetchTicketById.pending,   (s) => { s.detailLoading = true; })
      .addCase(fetchTicketById.fulfilled, (s, a) => { s.detailLoading = false; s.current = a.payload; })
      .addCase(fetchTicketById.rejected,  (s) => { s.detailLoading = false; })

      .addCase(updateTicketStatus.fulfilled, (s, a) => {
        s.current = a.payload;
        const idx = s.tickets.findIndex(t => t._id === a.payload._id);
        if (idx !== -1) s.tickets[idx] = a.payload;
      });
  },
});

export default supportSlice.reducer;