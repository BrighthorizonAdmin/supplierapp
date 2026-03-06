import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchReturns = createAsyncThunk('return/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/returns', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchReturnById = createAsyncThunk('return/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/returns/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createReturn = createAsyncThunk('return/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/returns', body);
    toast.success('Return request submitted');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const processReturn = createAsyncThunk('return/process', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/returns/${id}/process`, body);
    toast.success('Return processed and refund issued');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateReturnStatus = createAsyncThunk('return/updateStatus', async ({ id, status, reason }, { rejectWithValue }) => {
  try {
    const { data } = await api.patch(`/returns/${id}/status`, { status, reason });
    toast.success(`Return ${status}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const returnSlice = createSlice({
  name: 'return',
  initialState: { list: [], selected: null, pagination: null, loading: false, error: null },
  reducers: { clearSelected: (state) => { state.selected = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReturns.pending, (state) => { state.loading = true; })
      .addCase(fetchReturns.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchReturns.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchReturnById.fulfilled, (state, action) => { state.selected = action.payload; })
      .addCase(processReturn.fulfilled, (state, action) => {
        const idx = state.list.findIndex((r) => r._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(updateReturnStatus.fulfilled, (state, action) => {
        const idx = state.list.findIndex((r) => r._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?._id === action.payload._id) state.selected = action.payload;
      })
      .addCase(updateReturnStatus.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to update return status');
      });
  },
});

export const { clearSelected } = returnSlice.actions;
export default returnSlice.reducer;
