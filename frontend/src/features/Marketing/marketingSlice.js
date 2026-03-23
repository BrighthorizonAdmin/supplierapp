import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchLeads = createAsyncThunk('marketing/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/marketing-leads', { params });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to fetch leads');
  }
});

export const fetchLeadById = createAsyncThunk('marketing/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/marketing-leads/${id}`);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const createLead = createAsyncThunk('marketing/create', async (leadData, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/marketing-leads', leadData);
    toast.success(`Lead "${leadData.businessName}" has been successfully created and added to the pipeline.`);
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const updateLead = createAsyncThunk('marketing/update', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/marketing-leads/${id}`, body);
    toast.success('Lead updated successfully');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const logCall = createAsyncThunk('marketing/logCall', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.post(`/marketing-leads/${id}/log-call`, body);
    toast.success('Call logged successfully');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const requestDocuments = createAsyncThunk('marketing/requestDocs', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/marketing-leads/${id}/request-documents`);
    toast.success('Document request sent to dealer');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const advancePipeline = createAsyncThunk('marketing/advance', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/marketing-leads/${id}/advance-pipeline`);
    toast.success('Pipeline stage advanced');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const deleteLead = createAsyncThunk('marketing/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/marketing-leads/${id}`);
    toast.success('Lead deleted');
    return id;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchLeadStats = createAsyncThunk('marketing/stats', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/marketing-leads/stats');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

const marketingSlice = createSlice({
  name: 'marketing',
  initialState: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    submitting: false,
    error: null,
    stats: { total: 0, active: 0, converted: 0, documentCollection: 0, adminReview: 0 },
    createdLeadSuccess: null,
  },
  reducers: {
    clearSelected: (state) => { state.selected = null; },
    clearCreatedSuccess: (state) => { state.createdLeadSuccess = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLeads.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchLeads.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchLeadById.fulfilled, (state, action) => { state.selected = action.payload; })
      .addCase(createLead.pending, (state) => { state.submitting = true; })
      .addCase(createLead.fulfilled, (state, action) => {
        state.submitting = false;
        state.list.unshift(action.payload);
        state.selected = action.payload;
        state.createdLeadSuccess = action.payload;
        if (state.stats) state.stats.total += 1;
      })
      .addCase(createLead.rejected, (state, action) => { state.submitting = false; state.error = action.payload; })
      .addCase(updateLead.fulfilled, (state, action) => {
        const idx = state.list.findIndex((l) => l._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(logCall.fulfilled, (state, action) => {
        const idx = state.list.findIndex((l) => l._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(requestDocuments.fulfilled, (state, action) => {
        const idx = state.list.findIndex((l) => l._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(advancePipeline.fulfilled, (state, action) => {
        const idx = state.list.findIndex((l) => l._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(deleteLead.fulfilled, (state, action) => {
        state.list = state.list.filter((l) => l._id !== action.payload);
        if (state.selected?._id === action.payload) state.selected = null;
        if (state.stats) state.stats.total = Math.max(0, state.stats.total - 1);
      })
      .addCase(fetchLeadStats.fulfilled, (state, action) => { state.stats = action.payload; });
  },
});

export const { clearSelected, clearCreatedSuccess } = marketingSlice.actions;
export default marketingSlice.reducer;