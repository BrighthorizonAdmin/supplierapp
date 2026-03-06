import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import toast from 'react-hot-toast';

export const fetchSettings = createAsyncThunk('settings/fetch', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/settings');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const saveSettings = createAsyncThunk('settings/save', async (body, { rejectWithValue }) => {
  try {
    const { data } = await api.put('/settings', body);
    toast.success('Settings saved successfully');
    return data.data;
  } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { data: null, loading: false, saving: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending,  (state) => { state.loading = true; })
      .addCase(fetchSettings.fulfilled, (state, action) => { state.loading = false; state.data = action.payload; })
      .addCase(fetchSettings.rejected,  (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(saveSettings.pending,   (state) => { state.saving = true; })
      .addCase(saveSettings.fulfilled, (state, action) => { state.saving = false; state.data = action.payload; })
      .addCase(saveSettings.rejected,  (state, action) => {
        state.saving = false;
        toast.error(action.payload || 'Failed to save settings');
      });
  },
});

export default settingsSlice.reducer;
