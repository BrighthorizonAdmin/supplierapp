import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useSocketEvents } from '../../hooks/useSocketEvents';
import { usePermission } from '../../routes/ProtectedRoute';
import { fetchKPIs } from '../../features/dashboard/dashboardSlice';

const MainLayout = () => {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
  const hasKpis = useSelector((s) => Boolean(s.dashboard.kpis));
  const { hasPermission } = usePermission();
  const canReadDashboard = hasPermission('dashboard:read');
  useSocketEvents(); // Connect socket and listen to events

  // Sidebar counts (pending KYC, returns, tickets…) come from the dashboard KPIs.
  useEffect(() => {
    if (canReadDashboard && !hasKpis) dispatch(fetchKPIs());
  }, [canReadDashboard, hasKpis, dispatch]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas print:block print:h-auto print:overflow-visible">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className={`flex flex-1 flex-col overflow-hidden transition-[margin] duration-200 ${sidebarOpen ? 'ml-64' : 'ml-[72px]'} print:ml-0 print:block print:overflow-visible`}>
        <div className="print:hidden">
          <Topbar />
        </div>
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 print:overflow-visible print:p-0">
          <div className="mx-auto max-w-[1600px] print:max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
