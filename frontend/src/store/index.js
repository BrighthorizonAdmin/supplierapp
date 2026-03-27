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
import settingsReducer from '../features/notifications/settingsSlice';
import marketingReducer from '../features/Marketing/marketingSlice';
import uiReducer from './uiSlice';
import roleReducer from '../features/usermanagement/roleSlice';
import userReducer from '../features/usermanagement/userSlice';

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
    settings: settingsReducer,
    marketing: marketingReducer,
    ui: uiReducer,
    roles:roleReducer,
    users: userReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export default store;
