import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import Footer from './Footer';
import { useSocketEvents } from '../../hooks/useSocketEvents';

const MainLayout = () => {
  const sidebarOpen = useSelector((s) => s.ui.sidebarOpen);
  useSocketEvents(); // Connect socket and listen to events

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 print:block print:h-auto print:overflow-visible">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-200 ${sidebarOpen ? 'ml-64' : 'ml-16'} print:ml-0 print:block print:overflow-visible`}>
        <div className="print:hidden">
          <Topbar />
        </div>
        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          <Outlet />
        </main>
        <div className="print:hidden">
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;