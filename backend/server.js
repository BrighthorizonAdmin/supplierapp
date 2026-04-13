require('express-async-errors');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');

const env = require('./config/env');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { initSocket } = require('./websocket/socket');
const errorMiddleware = require('./middlewares/error.middleware');

// Route imports
const webhookRoutes = require('./modules/webhooks/webhook.routes');
const authRoutes = require('./modules/auth/auth.routes');
const dealerRoutes = require('./modules/dealer/dealer.routes');
const documentRoutes = require('./modules/dealer/document.routes');
const productRoutes = require('./modules/products/product.routes');
const warehouseRoutes = require('./modules/inventory/warehouse.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const orderRoutes = require('./modules/orders/order.routes');
const retailOrderRoutes = require('./modules/retailOrders/retailOrder.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const invoiceRoutes = require('./modules/payments/invoice.routes');
const returnRoutes = require('./modules/returns/return.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const roleRoutes = require('./modules/roles/role.routes');
const marketingLeadRoutes = require('./modules/marketingLeads/marketingLead.routes');
const { router: supportRoutes, whRouter: supportWebhookRoutes } = require('./modules/support/support.routes');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP to allow frontend assets to load
}));

// Static uploads are public assets (product images) — allow any origin to fetch them.
// This must come BEFORE the restricted CORS middleware below so the open policy
// applies to /uploads and the API routes stay protected.
app.use('/uploads', cors({ origin: '*' }), (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

app.use('/api/webhooks', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// CORS — API routes are restricted to the supplier frontend only
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Auth rate limit (100 req / 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Register webhooks BEFORE mongoSanitize so payload isn't mutated
app.use('/api/webhooks', webhookRoutes);
app.use('/api/webhooks', supportWebhookRoutes);

// NoSQL injection sanitization
app.use(mongoSanitize());

// HTTP logging
if (env.isDev) {
  app.use(morgan('dev'));
}

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

// API Routes
app.use('/api/support',  supportRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dealers', dealerRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/retail-orders', retailOrderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/marketing-leads', marketingLeadRoutes);

// Frontend routing - serve index.html for all non-API routes (React Router support)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

// 404 handler (only for unmatched API routes)
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Centralized error handler
app.use(errorMiddleware);

/**
 * Seed default roles if the Role collection is empty.
 * Runs once on startup so existing deployments retain their access without manual setup.
 */
const seedDefaultRoles = async () => {
  const Role = require('./modules/roles/role.model');
  const { DEFAULT_ROLES } = require('./utils/permissions');

  const count = await Role.countDocuments();
  if (count > 0) return;

  await Role.insertMany(DEFAULT_ROLES);
  logger.info('Default roles seeded successfully');
};

// Bootstrap
const startServer = async () => {
  await connectDB();
  await seedDefaultRoles();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Health: http://localhost:${env.PORT}/health`);
  });

  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    httpServer.close(() => process.exit(1));
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;