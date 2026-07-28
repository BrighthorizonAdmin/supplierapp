import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchBlogs = createAsyncThunk('blog/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/blog', { params });
    return res.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

export const fetchBlogById = createAsyncThunk('blog/fetchById', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/blog/${id}`);
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

// formData is a FormData instance — image upload requires multipart/form-data.
export const createBlog = createAsyncThunk('blog/create', async (formData, { rejectWithValue }) => {
  try {
    const res = await api.post('/blog', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

export const updateBlog = createAsyncThunk('blog/update', async ({ id, formData }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/blog/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.data;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

export const deleteBlog = createAsyncThunk('blog/delete', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/blog/${id}`);
    return id;
  } catch (err) { return rejectWithValue(err.response?.data); }
});

const blogSlice = createSlice({
  name: 'blog',
  initialState: {
    posts: [], pagination: null,
    current: null, loading: false, detailLoading: false, saving: false, error: null,
  },
  reducers: {
    clearCurrentBlog: (s) => { s.current = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBlogs.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(fetchBlogs.fulfilled, (s, a) => {
        s.loading = false;
        s.posts = a.payload.data;
        s.pagination = a.payload.pagination;
      })
      .addCase(fetchBlogs.rejected,  (s, a) => { s.loading = false; s.error = a.payload?.message; })

      .addCase(fetchBlogById.pending,   (s) => { s.detailLoading = true; })
      .addCase(fetchBlogById.fulfilled, (s, a) => { s.detailLoading = false; s.current = a.payload; })
      .addCase(fetchBlogById.rejected,  (s) => { s.detailLoading = false; })

      .addCase(createBlog.pending,   (s) => { s.saving = true; s.error = null; })
      .addCase(createBlog.fulfilled, (s, a) => { s.saving = false; s.posts.unshift(a.payload); })
      .addCase(createBlog.rejected,  (s, a) => { s.saving = false; s.error = a.payload?.message; })

      .addCase(updateBlog.pending,   (s) => { s.saving = true; s.error = null; })
      .addCase(updateBlog.fulfilled, (s, a) => {
        s.saving = false;
        s.current = a.payload;
        const idx = s.posts.findIndex((p) => p._id === a.payload._id);
        if (idx !== -1) s.posts[idx] = a.payload;
      })
      .addCase(updateBlog.rejected,  (s, a) => { s.saving = false; s.error = a.payload?.message; })

      .addCase(deleteBlog.fulfilled, (s, a) => { s.posts = s.posts.filter((p) => p._id !== a.payload); });
  },
});

export const { clearCurrentBlog } = blogSlice.actions;
export default blogSlice.reducer;
