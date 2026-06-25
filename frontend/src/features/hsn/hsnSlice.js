import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchHsnCategories = createAsyncThunk('hsn/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/categories');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createHsnCategory = createAsyncThunk('hsn/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/categories', body);
    toast.success('Category created successfully');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to create category');
    return rejectWithValue(err.response?.data?.message);
  }
});

export const updateHsnCategory = createAsyncThunk('hsn/update', async ({ id, hsnCode }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/categories/${id}`, { hsnCode });
    toast.success('HSN code updated');
    return data.data;
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to update HSN code');
    return rejectWithValue(err.response?.data?.message);
  }
});

const hsnSlice = createSlice({
  name: 'hsn',
  initialState: { list: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHsnCategories.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchHsnCategories.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchHsnCategories.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(createHsnCategory.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.list.sort((a, b) => a.name.localeCompare(b.name));
      })

      .addCase(updateHsnCategory.fulfilled, (state, action) => {
        const idx = state.list.findIndex(c => c._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      });
  },
});

export default hsnSlice.reducer;
