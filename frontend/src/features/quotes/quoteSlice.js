import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchQuotes = createAsyncThunk('quotes/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/quotes', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchQuoteById = createAsyncThunk('quotes/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/quotes/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createQuote = createAsyncThunk('quotes/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/quotes', body);
    toast.success('Quote created!');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to create quote');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const updateQuote = createAsyncThunk('quotes/update', async ({ id, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/quotes/${id}`, body);
    toast.success('Quote updated!');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to update quote');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const deleteQuote = createAsyncThunk('quotes/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/quotes/${id}`);
    toast.success('Quote deleted');
    return id;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to delete quote');
    return rejectWithValue(err.response?.data?.message);
  }
});

const quoteSlice = createSlice({
  name: 'quotes',
  initialState: {
    list:          [],
    pagination:    null,
    selectedQuote: null,
    loading:       false,
    error:         null,
  },
  reducers: {
    clearSelectedQuote: (state) => { state.selectedQuote = null; },
  },
  extraReducers: (builder) => {
    const pending  = (state)        => { state.loading = true;  state.error = null; };
    const rejected = (state, action)=> { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchQuotes.pending,   pending)
      .addCase(fetchQuotes.rejected,  rejected)
      .addCase(fetchQuotes.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.list       = payload.data       || [];
        state.pagination = payload.pagination || null;
      })
      .addCase(fetchQuoteById.pending,   pending)
      .addCase(fetchQuoteById.rejected,  rejected)
      .addCase(fetchQuoteById.fulfilled, (state, { payload }) => {
        state.loading       = false;
        state.selectedQuote = payload;
      })
      .addCase(createQuote.pending,   pending)
      .addCase(createQuote.rejected,  rejected)
      .addCase(createQuote.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.list    = [payload, ...state.list];
      })
      .addCase(updateQuote.pending,   pending)
      .addCase(updateQuote.rejected,  rejected)
      .addCase(updateQuote.fulfilled, (state, { payload }) => {
        state.loading       = false;
        state.selectedQuote = payload;
        state.list          = state.list.map((q) => (q._id === payload._id ? payload : q));
      })
      .addCase(deleteQuote.pending,   pending)
      .addCase(deleteQuote.rejected,  rejected)
      .addCase(deleteQuote.fulfilled, (state, { payload: id }) => {
        state.loading = false;
        state.list    = state.list.filter((q) => q._id !== id);
      });
  },
});

export const { clearSelectedQuote } = quoteSlice.actions;
export default quoteSlice.reducer;
