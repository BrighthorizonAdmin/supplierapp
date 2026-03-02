import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import dealerReducer from '../features/dealer/dealerSlice';
import inventoryReducer from '../features/inventory/inventorySlice';
import productReducer from '../features/products/productSlice';
import orderReducer from '../features/orders/orderSlice';
import retailOrderReducer from '../features/retail/retailOrderSlice';
import paymentReducer from '../features/payments/paymentSlice';
import returnReducer from '../features/returns/returnSlice';
import financeReducer from '../features/finance/financeSlice';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import notificationReducer from '../features/notifications/notificationSlice';
import auditReducer from '../features/audit/auditSlice';
import uiReducer from './uiSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    dealer: dealerReducer,
    inventory: inventoryReducer,
    product: productReducer,
    order: orderReducer,
    retailOrder: retailOrderReducer,
    payment: paymentReducer,
    return: returnReducer,
    finance: financeReducer,
    dashboard: dashboardReducer,
    notification: notificationReducer,
    audit: auditReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export default store;
