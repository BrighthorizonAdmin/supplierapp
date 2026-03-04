import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';

// Auth
import LoginPage from '../features/auth/pages/LoginPage';

// Pages (lazy would be better for production, keeping simple here)
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import DealerListPage from '../features/dealer/pages/DealerListPage';
import DealerDetailPage from '../features/dealer/pages/DealerDetailPage';
import DealerOnboardingPage from '../features/dealer/pages/DealerOnboardingPage';
import InventoryPage from '../features/inventory/pages/InventoryPage';
import ProductListPage from '../features/products/pages/ProductListPage';
import ProductFormPage from '../features/products/pages/ProductFormPage';
import OrderListPage from '../features/orders/pages/OrderListPage';
import OrderDetailPage from '../features/orders/pages/OrderDetailPage';
import RetailOrderListPage from '../features/retail/pages/RetailOrderListPage';
import PaymentListPage from '../features/payments/pages/PaymentListPage';
import InvoiceListPage from '../features/payments/pages/InvoiceListPage';
import ReturnListPage from '../features/returns/pages/ReturnListPage';
import FinancePage from '../features/finance/pages/FinancePage';
import AuditPage from '../features/audit/pages/AuditPage';
import NotificationPage from '../features/notifications/pages/NotificationPage';

const AppRouter = () => {
  const { isAuthenticated } = useSelector((s) => s.auth);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route
          path="/"
          element={<ProtectedRoute><MainLayout /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="onboarding" element={<DealerOnboardingPage />} />
          <Route path="dealers" element={<DealerListPage />} />
          <Route path="dealers/:id" element={<DealerDetailPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="products" element={<ProductListPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route path="orders" element={<OrderListPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="retail-orders" element={<RetailOrderListPage />} />
          <Route path="payments" element={<PaymentListPage />} />
          <Route path="invoices" element={<InvoiceListPage />} />
          <Route path="returns" element={<ReturnListPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="finance-reports" element={<FinancePage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="notifications" element={<NotificationPage />} />
          <Route path="unauthorized" element={<div className="p-8 text-center text-red-600 text-xl">Access Denied</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
