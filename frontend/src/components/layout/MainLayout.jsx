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
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-200 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;
