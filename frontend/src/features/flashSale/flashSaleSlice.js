import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchFlashSales = createAsyncThunk('flashSale/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/flash-sales', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchFlashSaleById = createAsyncThunk('flashSale/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/flash-sales/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createFlashSale = createAsyncThunk('flashSale/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/flash-sales', body);
    toast.success('Flash sale created');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateFlashSale = createAsyncThunk('flashSale/update', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/flash-sales/${id}`, body);
    // The enable/disable toggle sends only { isEnabled } — give it its own
    // message instead of the generic one used for full form edits.
    const isToggleOnly = Object.keys(body).length === 1 && 'isEnabled' in body;
    toast.success(isToggleOnly ? (body.isEnabled ? 'Flash sale enabled' : 'Flash sale disabled') : 'Flash sale updated');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteFlashSale = createAsyncThunk('flashSale/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/flash-sales/${id}`);
    toast.success('Flash sale deleted');
    return id;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const flashSaleSlice = createSlice({
  name: 'flashSale',
  initialState: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearSelectedFlashSale: (state) => { state.selected = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFlashSales.pending,   (state) => { state.loading = true; })
      .addCase(fetchFlashSales.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchFlashSales.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchFlashSaleById.fulfilled, (state, action) => { state.selected = action.payload; })

      .addCase(createFlashSale.fulfilled, (state, action) => {
        if (action.payload) state.list.unshift(action.payload);
      })
      .addCase(createFlashSale.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to create flash sale');
      })

      .addCase(updateFlashSale.fulfilled, (state, action) => {
        const idx = state.list.findIndex((f) => f._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateFlashSale.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to update flash sale');
      })

      .addCase(deleteFlashSale.fulfilled, (state, action) => {
        state.list = state.list.filter((f) => f._id !== action.payload);
      })
      .addCase(deleteFlashSale.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to delete flash sale');
      });
  },
});

export const { clearSelectedFlashSale } = flashSaleSlice.actions;
export default flashSaleSlice.reducer;
