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

// Upload new images one-by-one via POST /api/products/:id/images (multipart)
export const uploadProductImages = createAsyncThunk(
  'product/uploadImages',
  async ({ id, files }, { rejectWithValue }) => {
    try {
      let product = null;
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await api.post(`/products/${id}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        product = data.data;
      }
      return product;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

// Delete a specific image by fileName
export const deleteProductImage = createAsyncThunk(
  'product/deleteImage',
  async ({ id, fileName }, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`/products/${id}/images/${encodeURIComponent(fileName)}`);
      return data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

// Set a specific image as primary
export const setPrimaryImage = createAsyncThunk(
  'product/setPrimaryImage',
  async ({ id, fileName }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/products/${id}/images/${encodeURIComponent(fileName)}/primary`);
      return data.data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
  }
);

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
      .addCase(fetchProducts.pending,   (state) => { state.loading = true; })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchProducts.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchProductById.fulfilled, (state, action) => { state.selected = action.payload; })

      .addCase(createProduct.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(createProduct.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) state.list.unshift(action.payload);
      })
      .addCase(createProduct.rejected,  (state, action) => {
        state.loading = false;
        state.error = action.payload;
        const msg = action.payload?.toLowerCase().includes('sku')
          ? 'SKU already exists. Please use a different SKU code.'
          : action.payload || 'Failed to create product';
        toast.error(msg);
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

      .addCase(uploadProductImages.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to upload image(s)');
      })

      .addCase(deleteProductImage.fulfilled, (state, action) => {
        // Update selected product images after delete
        if (state.selected && action.payload) state.selected = action.payload;
      })
      .addCase(deleteProductImage.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to delete image');
      })

      .addCase(setPrimaryImage.fulfilled, (state, action) => {
        if (state.selected && action.payload) state.selected = action.payload;
      })
      .addCase(setPrimaryImage.rejected, (state, action) => {
        toast.error(action.payload || 'Failed to set primary image');
      })

      .addCase(fetchCategories.fulfilled, (state, action) => { state.categories = action.payload; });
  },
});

export const { clearSelected } = productSlice.actions;
export default productSlice.reducer;