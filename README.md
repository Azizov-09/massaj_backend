# Children's Massage & Rehabilitation CRM — Backend API

> Production-ready, secure, and high-performance backend CRM for a Children's Massage and Rehabilitation Center. Built with NestJS 11, Prisma ORM, PostgreSQL, Redis, and BullMQ.

---

## 🌟 Key Architectural Highlights

- **Role-Based Access Control (RBAC) & IDOR Protection**:
  - Roles: `SUPER_ADMIN`, `ADMIN`, `SPECIALIST`, `PARENT`.
  - Children are domain entities, not authentication roles. Access to children's clinical and personal data is protected by `AccessService` asserting parent-child custody and assigned specialist permissions.
- **Authentication & Session Lifecycle**:
  - Double-token architecture: short-lived access JWT (15m) + cryptographic refresh token in `HttpOnly`, `SameSite=Strict` cookie (30d).
  - Password hashing with **Argon2id**.
  - Token versioning (`tokenVersion`) allowing immediate session revocation across all active devices.
- **Financial Integrity**:
  - Monetary values stored in smallest currency units (Tiyin / Cents) to prevent floating-point inaccuracies.
  - Transactions managed inside ACID transactions with balance verification and refund threshold validations.
- **Clinical & Rehabilitation Engine**:
  - Structured SOAP clinical notes (Subjective, Objective, Assessment, Plan).
  - Treatment courses, milestone tracking, and contraindication logging with alert mechanisms.
  - Appointment lifecycle state machine with double-booking prevention and specialist conflict checking.
- **Async Processing & Infrastructure**:
  - Asynchronous background jobs powered by Redis and BullMQ.
  - SMS gateway integration (Eskiz.uz) with exponential backoff retry and mock delivery mode for non-production environments.
  - Real-time updates via WebSockets (`@nestjs/websockets` and `socket.io`).
- **Observability & Security**:
  - Secure HTTP headers via `helmet`.
  - Rate limiting with `@nestjs/throttler`.
  - Input validation with `class-validator` and `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`).
  - Automated health check endpoints (`/api/v1/health`).
  - Interactive OpenAPI/Swagger documentation (`/api/docs`).

---

## 🛠 Tech Stack

- **Runtime & Framework**: Node.js 20+, NestJS 11, Express
- **Database & ORM**: PostgreSQL 16+, Prisma ORM 6.16
- **Caching & Queues**: Redis 7, BullMQ 5.58, ioredis
- **Security**: Argon2, Passport/JWT, Helmet, Cookie-Parser, Throttler
- **Documentation**: Swagger / OpenAPI 3.0
- **Testing**: Jest 30, Supertest, ts-jest

---

## 🚀 Getting Started

### 1. Prerequisites

- Docker & Docker Compose
- Node.js 20+ and npm

### 2. Environment Setup

Copy `.env.example` to `.env` and set your local credentials:

```bash
cp .env.example .env
```

### 3. Start Database & Redis (Docker)

```bash
docker compose up -d
```

### 4. Install Dependencies & Generate Prisma Client

```bash
npm install
npx prisma generate
```

### 5. Run Database Migrations

```bash
npm run prisma:migrate
```

### 6. Start Development Server

```bash
npm run start:dev
```

The application will start on `http://localhost:3000`.
- **API Base URL**: `http://localhost:3000/api/v1`
- **Swagger Documentation**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/v1/health`

---

## 🧪 Testing & Code Quality

Execute the test suites and quality gates:

```bash
# Run unit tests (57 tests)
npm test

# Run ESLint validation (0 errors, 0 warnings)
npm run lint

# TypeScript strict type check
npm run typecheck

# Production build test
npm run build
```

---

## 📦 Project Structure

```text
src/
├── app/                  # Application root module & configuration
├── common/               # Shared guards, decorators, interceptors, services, utils
│   ├── decorators/       # CurrentUser, Roles, Public, etc.
│   ├── guards/           # JwtAuthGuard, RolesGuard, ThrottleGuard
│   ├── services/         # AccessService (IDOR defense)
│   └── utils/            # MoneyUtil, PhoneUtil, SecurityUtil
├── config/               # Joi validation schema & typed configs
├── database/             # Prisma client service with lifecycle hooks
├── infrastructure/       # BullMQ queues, Redis, SMS service (Eskiz)
└── modules/
    ├── analytics/        # Executive KPIs, retention, occupancy
    ├── announcements/    # Internal broadcast messages
    ├── appointments/     # Scheduling, slot locks, status transitions
    ├── auth/             # Login, register, refresh, logout, password reset
    ├── children/         # Child profiles, parent delegation
    ├── clinical/         # SOAP notes, treatment plans, contraindications
    ├── finance/          # Payments, invoices, refunds, transactions
    ├── health/           # Healthcheck and system probes
    ├── notifications/    # Multi-channel alerts (SMS, push, in-app)
    ├── platform/         # Audit logs, configuration, system health
    ├── portals/          # Dedicated parent & specialist workflows
    ├── profiles/         # User and specialist profile management
    ├── reports/          # Financial and clinical reporting
    ├── services/         # Center service catalog & pricing tiers
    └── sessions/         # Session execution, attendance tracking
```

---

## 🔒 Security Best Practices

1. **Strict IDOR Mitigation**:
   Specialists and Parents can only access records specifically assigned to them or their children via `AccessService.assertChildAccess()`.
2. **Double Cookie & Header Strategy**:
   Short-lived JWT in `Authorization: Bearer <token>` for API requests; Refresh token strictly isolated in `HttpOnly; SameSite=Strict` cookie.
3. **Database Concurrency**:
   Critical operations (financial movements, appointment booking) execute within Prisma transactions with isolation checks.

---

## 📄 License

UNLICENSED — Private and proprietary system for Children's Massage & Rehabilitation CRM.
