const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, FRONTEND_URL } = require('../config/env');
const logger = require('../utils/logger');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(`user:${id}`);
    socket.join(`role:${role}`);
    socket.join('global');
    logger.info(`Socket connected: user=${id} role=${role}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user=${id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

const emitToUser = (userId, event, data) => {
  getIO().to(`user:${userId}`).emit(event, data);
};

const emitToRole = (role, event, data) => {
  getIO().to(`role:${role}`).emit(event, data);
};

const emitToAll = (event, data) => {
  getIO().to('global').emit(event, data);
};

module.exports = { initSocket, getIO, emitToUser, emitToRole, emitToAll };
