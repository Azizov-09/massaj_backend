# Massaj CRM Backend Audit Report

Date: 2026-10-18 (Asia/Tashkent)

## Root causes addressed

- Assessment/progress list responses did not expose normalized child and specialist identities.
- Clinical event time was conflated with row creation time.
- Legacy callers could send a User UUID where finance expected a Parent profile UUID.
- Financial retries were not uniformly idempotent and serializable conflicts had no bounded retry.
- Payment success notifications needed the same atomic boundary as payment and ledger writes.
- Access JWTs trusted an embedded role and were not bound to a revocable session.
- Goals runtime dependencies remained after the product decision to remove the feature.

## Implemented changes

- Relation-aware assessment/progress list and detail responses, filters, pagination, access scoping, and future-date validation.
- Non-destructive `assessedAt`/`occurredAt` migration with existing-row backfill from `createdAt`.
- Goals API/service/DTO/portal/seed removal while retaining historical database rows pending approval.
- Parent identifier normalization, mandatory idempotency, serializable payment/refund/charge transactions, conflict retry, post-commit realtime emission, and payer/child presentation.
- Finance read RBAC, admin session revocation, refresh replay containment, database-role resolution, and session-bound HTTP/WebSocket access tokens.
- Read-only data-integrity audit command and coordinated frontend contract.

## Database migration status

`prisma/migrations/20261017090000_add_clinical_event_dates` is non-destructive. It adds and backfills clinical event timestamps and indexes. It has not been applied to production. Goals destructive migration is intentionally absent and requires explicit approval.

## Data integrity diagnostics

Run `npm run audit:data-integrity` using a read-only account. Production additionally requires `PRODUCTION_DIAGNOSTICS_APPROVED=true`. The command reports only counts and record IDs; it does not modify rows or print patient names.

Checks cover orphan clinical rows, invalid payment relations, payment/ledger mismatches, invalid amounts, duplicate idempotency keys, invalid payment notifications, future clinical records, retained Goals, and unsupported legacy outbox events.

The 2026-10-18 read-only local audit completed 11 checks. Eight passed. It found no orphan assessment/progress rows, invalid payment relations, non-positive amounts, duplicate financial idempotency keys, invalid payment notifications, future clinical records, or unsupported outbox events. It reported three deployment/data items that were intentionally not mutated:

- the current local database is missing both clinical timestamp columns from the pending migration;
- 50 legacy seeded payments do not have exactly one ledger row linked through `Transaction.paymentId`;
- 35 historical Goal rows remain pending an approved archive/drop decision.

The seed generator now creates linked Payment/Transaction pairs for future seed runs. Existing ledger links and Goal rows require a separately approved repair/archive operation.

## Verification results

- Unit/regression: 15/15 suites and 106/106 tests passed.
- Isolated E2E: 1/1 suite and 32/32 workflows passed, including expired-token refresh, clinical relation/filter/date checks, IDOR/RBAC, and concurrent payment idempotency.
- TypeScript typecheck, ESLint with zero warnings, and Nest production build passed.
- Prisma schema validation and client generation passed.
- All six migrations applied successfully to a generated local PostgreSQL schema; the schema and dedicated empty Redis test database were cleaned after the run.
- Direct `npm run test:e2e` refuses to run without isolated `TEST_DATABASE_URL` and `TEST_REDIS_URL`, preventing accidental use of the configured application database.

## Frontend coordination

Use `docs/frontend-api-contract.md`. Mandatory coordinated changes are idempotency keys for finance mutations, whole-UZS amounts, HttpOnly-cookie refresh handling, and forced re-login for legacy access tokens that lack a session ID.

## Pending approval or external prerequisites

- Production read-only diagnostics approval and credentials.
- Goals historical archive/drop approval.
- Approval and a reviewed repair script for the 50 legacy payment/ledger links.
- Deployment, monitoring, backup, and rollback owner confirmation.

## Release risks

- A client released without required idempotency keys will receive `400`.
- Existing access tokens without `sid` are rejected and require login.
- Applying application code before the clinical timestamp migration will fail clinical queries.
- Removing Goals data without completing the archive/checksum gate is irreversible data loss.
