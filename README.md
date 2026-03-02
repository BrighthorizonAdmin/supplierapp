# Supplier Management System

A production-ready full-stack Supplier Management Application built with the MERN stack.

## Architecture

```
supplierapp/
├── backend/        Node.js + Express + MongoDB API (port 3001)
└── frontend/       React + Vite + Redux web app (port 5001)
```

## Tech Stack

**Backend:** Node.js, Express, MongoDB, Mongoose, JWT (stateless), Socket.io, Multer, Winston, Helmet, RBAC

**Frontend:** React, Vite, Redux Toolkit, React Router v6, TailwindCSS, Recharts, React Hook Form, Socket.io-client

## Modules

| Module | Features |
|---|---|
| Dashboard | KPI cards, revenue charts, real-time Socket.io updates |
| Dealers | Onboarding, approval (GST/PAN validation), KYC, credit limit |
| Inventory | Multi-warehouse stock, allocation tracking, low-stock alerts |
| Products | Catalog with tier pricing, image upload |
| B2B Orders | Create, confirm (with credit + stock check), cancel |
| Retail Orders | Dealer-to-customer orders |
| Returns | 30-day RMA, inventory restore, refund processing |
| Payments | Partial payments, multi-invoice allocation, immutable on confirm |
| Invoices | Auto-generated per order, status tracking |
| Finance | Revenue aggregation, P&L, dealer ledger |
| Audit Logs | Append-only, immutable audit trail |
| Notifications | Real-time via Socket.io |

## RBAC Roles

- **Super Admin** — full access
- **Admin** — all except finance write
- **Finance** — finance, payments, invoices
- **Inventory Manager** — inventory, products, warehouses
- **Onboarding Manager** — dealer onboarding and KYC
- **Support** — read-only on dealers, orders, returns
- **Read Only** — read access to all modules

## Setup

### Prerequisites
- Node.js >= 18
- MongoDB >= 6
- npm >= 9

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
node server.js
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (backend/.env)

```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/supplierDB
JWT_SECRET=your_strong_secret_here
JWT_EXPIRES_IN=8h
FRONTEND_URL=http://localhost:5001
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

## API Endpoints

### Auth
```
POST /api/auth/login          { email, password }
POST /api/auth/register       { name, email, password, role }
GET  /api/auth/me
```

### Dealers
```
GET    /api/dealers            ?status=pending&search=...&page=1
POST   /api/dealers
PATCH  /api/dealers/:id/approve  { creditLimit, pricingTier }
PATCH  /api/dealers/:id/reject   { reason }
PATCH  /api/dealers/:id/suspend  { reason }
```

### Orders
```
POST   /api/orders             { dealerId, items[], notes }
PATCH  /api/orders/:id/confirm
PATCH  /api/orders/:id/cancel  { reason }
```

### Payments
```
POST   /api/payments           { dealerId, amount, method, allocations[] }
PATCH  /api/payments/:id/confirm
```

### Returns
```
POST   /api/returns            { orderId, items[], reason }
PATCH  /api/returns/:id/process  { refundAmount, refundMethod }
```

## Key Business Rules

1. **Dealer Approval** — GST + PAN uniqueness enforced at DB level; approval is atomic (MongoDB transaction)
2. **Order Confirmation** — checks dealer active, credit limit, allocates stock atomically
3. **Inventory** — can never go negative; uses `$inc` with `$expr` guard
4. **Payment** — status immutable once `confirmed` (pre-save hook)
5. **Returns** — 30-day window enforced in service; refund cannot exceed order total
6. **Audit Logs** — append-only schema with pre-hook guards on update/delete

## Real-time Events (Socket.io)

| Event | Trigger |
|---|---|
| `dealer:approved` | Dealer approval |
| `order:confirmed` | Order confirmation |
| `payment:confirmed` | Payment confirmation |
| `inventory:low_stock` | Stock below reorder level |
| `notification:new` | New notification |
| `dashboard:kpi_update` | KPI refresh |

## Security

- JWT stateless auth (8h expiry)
- Bcrypt password hashing (12 rounds)
- Rate limiting on auth and API endpoints
- NoSQL injection prevention via express-mongo-sanitize
- HTTP security headers via helmet
- CORS restricted to FRONTEND_URL