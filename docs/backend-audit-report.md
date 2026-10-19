# Massaj CRM Backend Finalization Report

Date: 2026-10-19 (Asia/Tashkent)

## Database and migration result

- Eight migrations apply in order on a generated isolated PostgreSQL schema.
- `Assessment.assessedAt` and `ProgressEntry.occurredAt` are backfilled from `createdAt`, required, indexed, and used by the API.
- Appointment/calendar tables and relations are restored in a dedicated non-destructive migration.
- Payment/Transaction amounts are positive by database checks; one PAYMENT ledger row per Payment is enforced by a partial unique index; PAYMENT shape requires a linked Payment, parent, child, and IN direction.
- Transaction idempotency storage is 512 characters so a valid 255-character client key remains valid after internal prefixes.
- Goals removal is a separate transactional migration and fails while Goal rows remain.
- The approved localhost development database was reset; `prisma migrate status` reports the schema is up to date.

## Seed result

Dataset: `massaj-development-v2`.

- Users: 7 (Super Admin, Admin, 2 Specialists, 3 Parents)
- Appointments: 30 (three 10-session courses)
- Attendance: 18 (six completed sessions per course)
- Assessments: 3
- Progress records: 3
- Payments: 3
- Seed ledger transactions: 21 (18 charges + 3 linked payments)
- Notifications: 15 (12 appointment reminders + 3 payment confirmations)

Expected account states are verified after every seed:

- Parent 1: 400,000 UZS debt
- Parent 2: 0 balance / 0 debt
- Parent 3: 200,000 UZS balance

The seed was run twice inside the reset workflow and once again independently. Counts and ledger invariants remained unchanged; no duplicate rows were created.

## Goals removal

The previous localhost dataset contained 35 Goal rows and matched the legacy deterministic seed. Before reset, those rows were written to `.local-backups/` with a SHA-256 sidecar and the saved payload was re-read for checksum verification. After migration, the Goal table and `GoalStatus` enum are absent. Runtime and seed code contain no Goals dependency. Production was not changed.

Production backup, approval, deployment, and rollback requirements are documented in `docs/goals-removal-plan.md`.

## Payment and ledger integrity

- Payment, PAYMENT transaction, notification, and audit log commit in one Serializable transaction.
- Retries are idempotent; reusing a key for different data returns 409.
- Invalid/failed requests roll back fully, do not change balances, and do not create success notifications.
- Whole-UZS integer validation is enforced in DTOs and positive amounts are enforced in PostgreSQL.
- The read-only integrity audit checks both missing/multiple payment ledgers and orphan/mismatched PAYMENT ledger rows.
- Post-reset audit result: 12/12 PASS, including zero payment/ledger mismatches.

## Frontend API contract

Verified endpoints under `/api/v1`:

- `POST /payments`
- `GET /payments`
- `GET /debtors`
- `GET /assessments`
- `GET /progress`
- `POST /auth/refresh`
- `GET /notifications`
- Appointment calendar CRUD/list/status endpoints

Refresh rotates an HttpOnly cookie and returns only an access token. Credentialed CORS and WebSocket origins use the same normalized `FRONTEND_URL`/`FRONTEND_ORIGINS` allowlist. Production config requires HTTPS frontend URL and `COOKIE_SECURE=true`.

## Verification

- Prisma validate/generate: PASS
- Unit/regression: 16/16 suites, 111/111 tests PASS
- Isolated integration/E2E: 1/1 suite, 35/35 tests PASS
- Isolated migration chain: 8/8 PASS
- Seeder repeat/idempotency: PASS
- Local migration status: up to date
- Local data-integrity audit: 12/12 PASS
- TypeScript typecheck: PASS
- ESLint with zero warnings: PASS
- Nest production build: PASS

## Deployment constraints

- No production reset, migration deploy, or application deploy was performed.
- For a production database with Goal rows, the Goals migration intentionally blocks until the approved encrypted backup/archive and row-clear procedure is complete.
- Historical appointments removed by the old `20261010100000_remove_appointments_and_sessions` migration cannot be recreated by the new schema migration; restore them only from a verified historical backup if required.
- Prisma's `package.json#prisma` seed configuration is deprecated for Prisma 7 and should move to `prisma.config.ts` during the future major upgrade.
