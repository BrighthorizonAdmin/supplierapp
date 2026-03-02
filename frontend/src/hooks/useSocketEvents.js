import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { updateKPIs } from '../features/dashboard/dashboardSlice';
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

    socket.on('dashboard:kpi_update', (data) => {
      dispatch(updateKPIs(data));
    });

    socket.on('notification:new', (data) => {
      dispatch(addNotification(data));
      toast(data.message, { icon: '🔔', duration: 5000 });
    });

    socket.on('dealer:approved', (data) => {
      toast.success(`Dealer ${data.businessName} approved`);
    });

    socket.on('order:confirmed', (data) => {
      toast.success(`Order ${data.orderNumber} confirmed`);
    });

    socket.on('payment:confirmed', (data) => {
      toast.success(`Payment ₹${data.amount} confirmed`);
    });

    socket.on('inventory:low_stock', (data) => {
      toast(`Low stock alert for product`, { icon: '⚠️', duration: 6000 });
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, token]);

  return socketRef;
};
