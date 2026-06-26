import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchChallans = createAsyncThunk('challans/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/delivery-challans', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchChallanById = createAsyncThunk('challans/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/delivery-challans/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createChallan = createAsyncThunk('challans/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/delivery-challans', body);
    toast.success('Delivery Challan created!');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to create challan');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const updateChallan = createAsyncThunk('challans/update', async ({ id, body }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/delivery-challans/${id}`, body);
    toast.success('Delivery Challan updated!');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to update challan');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const deleteChallan = createAsyncThunk('challans/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/delivery-challans/${id}`);
    toast.success('Delivery Challan deleted');
    return id;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to delete challan');
    return rejectWithValue(err.response?.data?.message);
  }
});

const challanSlice = createSlice({
  name: 'challans',
  initialState: {
    list:            [],
    pagination:      null,
    selectedChallan: null,
    loading:         false,
    error:           null,
  },
  reducers: {
    clearSelectedChallan: (state) => { state.selectedChallan = null; },
  },
  extraReducers: (builder) => {
    const pending  = (state)         => { state.loading = true;  state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchChallans.pending,   pending)
      .addCase(fetchChallans.rejected,  rejected)
      .addCase(fetchChallans.fulfilled, (state, { payload }) => {
        state.loading    = false;
        state.list       = payload.data       || [];
        state.pagination = payload.pagination || null;
      })
      .addCase(fetchChallanById.pending,   pending)
      .addCase(fetchChallanById.rejected,  rejected)
      .addCase(fetchChallanById.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.selectedChallan = payload;
      })
      .addCase(createChallan.pending,   pending)
      .addCase(createChallan.rejected,  rejected)
      .addCase(createChallan.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.list    = [payload, ...state.list];
      })
      .addCase(updateChallan.pending,   pending)
      .addCase(updateChallan.rejected,  rejected)
      .addCase(updateChallan.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.selectedChallan = payload;
        state.list            = state.list.map((c) => (c._id === payload._id ? payload : c));
      })
      .addCase(deleteChallan.pending,   pending)
      .addCase(deleteChallan.rejected,  rejected)
      .addCase(deleteChallan.fulfilled, (state, { payload: id }) => {
        state.loading = false;
        state.list    = state.list.filter((c) => c._id !== id);
      });
  },
});

export const { clearSelectedChallan } = challanSlice.actions;
export default challanSlice.reducer;
