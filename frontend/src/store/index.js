import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import dealerReducer from '../features/dealer/dealerSlice';
import inventoryReducer from '../features/inventory/inventorySlice';
import productReducer from '../features/products/productSlice';
import orderReducer from '../features/orders/orderSlice';
import retailOrderReducer from '../features/retail/retailOrderSlice';
import paymentReducer from '../features/payments/paymentSlice';
import returnReducer from '../features/returns/returnSlice';
import exchangeReducer from '../features/exchanges/exchangeSlice';
import financeReducer from '../features/finance/financeSlice';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import notificationReducer from '../features/notifications/notificationSlice';
import auditReducer from '../features/audit/auditSlice';
import settingsReducer from '../features/notifications/settingsSlice';
import marketingReducer from '../features/Marketing/marketingSlice';
import uiReducer from './uiSlice';
import roleReducer from '../features/usermanagement/roleSlice';
import userReducer from '../features/usermanagement/userSlice';
import supportReducer from '../features/support/supportSlice';
import warrantyReducer from '../features/warranty/warrantySlice';
import quoteReducer from '../features/quotes/quoteSlice';
import hsnReducer from '../features/hsn/hsnSlice';
import challanReducer from '../features/deliveryChallan/deliveryChallanSlice';


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
    exchange: exchangeReducer,
    finance: financeReducer,
    dashboard: dashboardReducer,
    notification: notificationReducer,
    audit: auditReducer,
    settings: settingsReducer,
    marketing: marketingReducer,
    ui: uiReducer,
    roles:roleReducer,
    users: userReducer,
    support: supportReducer,
    warranty: warrantyReducer,
    quotes: quoteReducer,
    hsn:   hsnReducer,
    challans: challanReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export default store;
