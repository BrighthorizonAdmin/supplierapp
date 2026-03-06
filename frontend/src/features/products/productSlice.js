import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchProducts = createAsyncThunk('product/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/products', { params });
    return data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchProductById = createAsyncThunk('product/fetchById', async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/products/${id}`);
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createProduct = createAsyncThunk('product/create', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/products', body);
    toast.success('Product created');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const updateProduct = createAsyncThunk('product/update', async ({ id, ...body }, { rejectWithValue }) => {
  try {
    const { data } = await api.put(`/products/${id}`, body);
    toast.success('Product updated');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchCategories = createAsyncThunk('product/categories', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/products/categories');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const productSlice = createSlice({
  name: 'product',
  initialState: {
    list: [],
    selected: null,
    categories: [],
    pagination: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearSelected: (state) => { state.selected = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.loading = true; })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchProducts.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchProductById.fulfilled, (state, action) => { state.selected = action.payload; })
      .addCase(createProduct.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) state.list.unshift(action.payload);
      })
      .addCase(createProduct.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload || 'Failed to create product');
      })
      .addCase(updateProduct.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(updateProduct.fulfilled, (state, action) => {
        state.loading = false;
        const idx = state.list.findIndex((p) => p._id === action.payload._id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateProduct.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload || 'Failed to update product');
      })
      .addCase(fetchCategories.fulfilled, (state, action) => { state.categories = action.payload; });
  },
});

export const { clearSelected } = productSlice.actions;
export default productSlice.reducer;
