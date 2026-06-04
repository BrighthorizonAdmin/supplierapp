import axios from 'axios';
import toast from 'react-hot-toast';

// sessionStorage survives page refresh but is cleared when the tab closes.
// Seeding _authToken from it means the axios interceptor has the token
// immediately on page load without an extra /me round-trip.
let _authToken = sessionStorage.getItem('token');

export const setAuthToken = (token) => {
  _authToken = token;
  if (token) sessionStorage.setItem('token', token);
  else sessionStorage.removeItem('token');
};

const api = axios.create({
  baseURL: 'https://supplier.dealerkart.biz/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT from memory (never localStorage)
api.interceptors.request.use(
  (config) => {
    if (_authToken) config.headers.Authorization = `Bearer ${_authToken}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Cancellations are intentional (component unmount / re-fetch debounce) — never toast
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    const message = error.response?.data?.message || 'Something went wrong';
    const status  = error.response?.status;

    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (status === 401 && !isLoginRequest) {
      setAuthToken(null);
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('permissions');
      window.location.href = '/login';
      toast.error('Session expired. Please log in again.');
    } else if (status === 403) {
      toast.error('You do not have permission for this action.');
    } else if (status !== 400 && status !== 404 && status !== 409) {
      // Don't auto-toast for form validation errors
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
