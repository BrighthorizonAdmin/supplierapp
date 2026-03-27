import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';

// Auth
import LoginPage from '../features/auth/pages/LoginPage';
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from '../features/auth/pages/ResetPasswordPage';

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
import MarketingPage from '../features/Marketing/pages/MarketingPage';
import AddMarketingLeadPage from '../features/Marketing/pages/AddMarketingLeadPage';
import MarketingLeadDetailPage from '../features/Marketing/pages/MarketingLeadDetailPage';
import RoleManagementPage from '../features/usermanagement/pages/RoleManagement';
import UserManagementPage from '../features/usermanagement/pages/UserManagement';
import InvoiceFormPage from '../features/payments/pages/InvoiceFormPage';
import InvoiceDetailPage from '../features/payments/pages/InvoiceDetailPage';

import ChangePassword from '../features/usermanagement/pages/ChangePassword';

const AppRouter = () => {
  const { isAuthenticated} = useSelector((s) => s.auth);

  return (
    <HashRouter >
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />} />
        <Route path="/changePassword" element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        } />
        <Route
          path="/"
          element={<ProtectedRoute><MainLayout /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"
            element={
              <ProtectedRoute permission="dashboard:read">
                <DashboardPage />
              </ProtectedRoute>} />
          <Route path="onboarding"
            element={
              <ProtectedRoute permission="dealer:read">
                <DealerOnboardingPage />
              </ProtectedRoute>
            } />
          <Route path="dealers"
            element={
              <ProtectedRoute permission="dealer:read">
                <DealerListPage />
              </ProtectedRoute>
            } />
          <Route path="dealers/:id" element={
            <ProtectedRoute permission="dealer:read">
              <DealerDetailPage />
            </ProtectedRoute>
          } />
          <Route path="inventory" element={
            <ProtectedRoute permission="inventory:read">
              <InventoryPage />
            </ProtectedRoute>
          } />
          <Route path="products" element={
            <ProtectedRoute permission="products:read">
              <ProductListPage />
            </ProtectedRoute>
          } />
          <Route path="products/new" element={
            <ProtectedRoute permission="products:write">
              <ProductFormPage />
            </ProtectedRoute>
          } />
          <Route path="products/:id/edit" element={
            <ProtectedRoute permission="products:write">
              <ProductFormPage />
            </ProtectedRoute>
          } />
          <Route path="orders" element={
            <ProtectedRoute permission="orders:read">
              <OrderListPage />
            </ProtectedRoute>
          } />
          <Route path="orders/:id" element={
            <ProtectedRoute permission="orders:read">
              <OrderDetailPage />
            </ProtectedRoute>
          } />
          <Route path="retail-orders" element={
            <ProtectedRoute permission="retailOrders:read">
              <RetailOrderListPage />
            </ProtectedRoute>
          } />
          <Route path="payments" element={
            <ProtectedRoute permission="payments:read">
              <PaymentListPage />
            </ProtectedRoute>
          } />
          <Route path="invoices" element={
            <ProtectedRoute permission="invoices:read">
              <InvoiceListPage />
            </ProtectedRoute>
          } />
          <Route path="invoices/new" element={
            <ProtectedRoute permission="invoices:write">
              <InvoiceFormPage />
            </ProtectedRoute>
          } />
          <Route path="invoices/:id" element={
            <ProtectedRoute permission="invoices:read">
              <InvoiceDetailPage />
            </ProtectedRoute>
          } />
          <Route path="invoices/:id/edit" element={
            <ProtectedRoute permission="invoices:write">
              <InvoiceFormPage />
            </ProtectedRoute>
          } />
          <Route path="returns" element={
            <ProtectedRoute permission="returns:read">
              <ReturnListPage />
            </ProtectedRoute>
          } />
          <Route path="finance" element={
            <ProtectedRoute permission="finance:read">
              <FinancePage />
            </ProtectedRoute>
          } />
          <Route path="audit" element={
            <ProtectedRoute permission="audit:read">
              <AuditPage />
            </ProtectedRoute>
          } />
          <Route path="notifications" element={
            <ProtectedRoute permission='notifications:read'>
              <NotificationPage />
            </ProtectedRoute>
          } />
          <Route path="marketing-leads" element={
            <ProtectedRoute permission='marketing:read'>
              <MarketingPage />
            </ProtectedRoute>
            } />
          <Route path="marketing-leads/new" element={
            <ProtectedRoute permission="marketing:write">
              <AddMarketingLeadPage />
            </ProtectedRoute>
            } />
          <Route path="marketing-leads/:id" element={
            <ProtectedRoute permission="marketing:read">
              <MarketingLeadDetailPage />
            </ProtectedRoute>
            } />
          
          <Route path="rolemanagement" element={
            <ProtectedRoute permission="admin:read">
              <RoleManagementPage />
            </ProtectedRoute>
          } />
          <Route path="usermanagement" element={
            <ProtectedRoute permission="admin:read">
              <UserManagementPage />
            </ProtectedRoute>
          } />
          <Route path="unauthorized" element={<div className="p-8 text-center text-red-600 text-xl">Access Denied</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter >
  );
};

export default AppRouter;
