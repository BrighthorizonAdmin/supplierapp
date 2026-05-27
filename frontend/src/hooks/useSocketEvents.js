import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { updateKPIs, fetchKPIs, fetchRecentOrders } from '../features/dashboard/dashboardSlice';
import { addNotification } from '../features/notifications/notificationSlice';

export const useSocketEvents = () => {
  const dispatch = useDispatch();
  const { token, isAuthenticated } = useSelector((s) => s.auth);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = io('/', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    // Real-time KPI push from backend — merge into existing state
    socket.on('dashboard:kpi_update', (data) => {
      dispatch(updateKPIs(data));
    });

    socket.on('notification:new', (data) => {
      dispatch(addNotification(data));
      toast(data.message, { icon: '🔔', duration: 5000 });
    });

    socket.on('dealer:approved', (data) => {
      toast.success(`Dealer ${data.businessName} approved`);
      dispatch(fetchKPIs());
    });

    // New order confirmed — refresh KPIs + recent orders list
    socket.on('order:confirmed', (data) => {
      toast.success(`Order ${data.orderNumber} confirmed`);
      dispatch(fetchKPIs());
      dispatch(fetchRecentOrders());
    });

    // Order cancelled — refresh KPIs
    socket.on('order:cancelled', () => {
      dispatch(fetchKPIs());
      dispatch(fetchRecentOrders());
    });

    // Payment received — refresh KPIs (month revenue changes)
    socket.on('payment:confirmed', (data) => {
      toast.success(`Payment ₹${data.amount?.toLocaleString('en-IN')} confirmed`);
      dispatch(fetchKPIs());
    });

    // Low stock — refresh KPIs (lowStockAlerts count changes)
    socket.on('inventory:low_stock', () => {
      toast(`Low stock alert for product`, { icon: '⚠️', duration: 6000 });
      dispatch(fetchKPIs());
    });

    // Return processed — refresh KPIs (pendingReturns changes)
    socket.on('return:processed', () => {
      dispatch(fetchKPIs());
    });

    // New warranty claim — refresh KPIs (warrantyPending changes)
    socket.on('warranty:new_claim', (data) => {
      toast(`New warranty claim from ${data.dealerName}`, { icon: '🛡️', duration: 5000 });
      dispatch(fetchKPIs());
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, token]);

  return socketRef;
};
