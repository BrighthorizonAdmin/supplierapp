import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchEnquiries = createAsyncThunk('websiteEnquiries/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/website-enquiries', { params });
    return res.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

export const fetchEnquiryById = createAsyncThunk('websiteEnquiries/fetchById', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/website-enquiries/${id}`);
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

export const updateEnquiryStatus = createAsyncThunk('websiteEnquiries/updateStatus', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const res = await api.patch(`/website-enquiries/${id}/status`, body);
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

const websiteEnquirySlice = createSlice({
  name: 'websiteEnquiries',
  initialState: {
    enquiries: [], pagination: null, meta: null,
    current: null, loading: false, detailLoading: false, error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEnquiries.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(fetchEnquiries.fulfilled, (s, a) => {
        s.loading = false;
        s.enquiries = a.payload.data;
        s.pagination = a.payload.pagination;
        s.meta = a.payload.meta;
      })
      .addCase(fetchEnquiries.rejected,  (s, a) => { s.loading = false; s.error = a.payload?.message; })

      .addCase(fetchEnquiryById.pending,   (s) => { s.detailLoading = true; })
      .addCase(fetchEnquiryById.fulfilled, (s, a) => { s.detailLoading = false; s.current = a.payload; })
      .addCase(fetchEnquiryById.rejected,  (s) => { s.detailLoading = false; })

      .addCase(updateEnquiryStatus.fulfilled, (s, a) => {
        s.current = a.payload;
        const idx = s.enquiries.findIndex(e => e._id === a.payload._id);
        if (idx !== -1) s.enquiries[idx] = a.payload;
      });
  },
});

export default websiteEnquirySlice.reducer;
