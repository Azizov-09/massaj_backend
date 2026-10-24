# MASSAJ CRM — Phone-only User Management Refactor

Date: 2026-10-24 (Asia/Tashkent)

Status: implemented and verified in an isolated PostgreSQL schema. No production database reset, migration deploy, or application deploy was performed.

## Auto-detect and API map

Project type: Booking/Service CRM + Admin/Internal Tool + financial ledger. Confidence: high. Signals include appointments, specialists, parents/children, admin RBAC, payments, debts, transactions, audit logs, and role portals.

Affected routes:

| Resource | Create/read/update | Lifecycle |
|---|---|---|
| Auth | `POST /auth/login`, refresh/logout/change-password | Phone + password only; inactive/archived/blocked denied |
| Admin | `POST/GET/PATCH /admins` | `POST /admins/:id/activate`, `deactivate`, `archive`, `restore` |
| Parent | `POST/GET/PATCH /parents` | `PATCH /parents/:id/status`, `POST .../archive`, `POST .../restore`, `DELETE /parents/:id` soft-archive alias |
| Specialist | `POST/GET/PATCH /specialists` | `PATCH /specialists/:id/status`, `POST .../archive`, `POST .../restore` |
| Employee | `POST/GET/PATCH /employees` | `POST /employees/:id/activate`, `deactivate`, `archive`, `restore` |
| Appointment | `POST/PATCH /appointments` | Rejects inactive/archived accounts and non-working weekdays |

All routes above require the existing JWT/RBAC guards. Admin lifecycle management remains `SUPER_ADMIN` only; Parent/Specialist management is `SUPER_ADMIN` or `ADMIN`.

## Root causes and fixes

### BE-01 — Email still existed in the account contract

Root cause: `User.email` and `Employee.email` remained in Prisma, admin/employee DTOs, Prisma selections, bootstrap environment configuration, seed tests, and API response projections.

Fix: removed email from current schema/runtime/DTOs/responses/bootstrap. The historical migration that originally added email remains immutable; the new forward migration removes the columns and index. Certbot's operational certificate-contact email is unrelated to a CRM identity and remains in `scripts/setup-ssl.sh`.

### BE-02 — Specialist create returned 400

Root cause: strict whitelist correctly rejected stale `email`; `@Length(1)` rejected `bio: ""`; DTO/schema/service had no workday contract.

Fix: email is absent, empty bio transforms to `null`, User + Specialist + preferences + audit log are one transaction, phone is normalized, duplicate phone maps to 409, and `workingDays` uses canonical ISO 1–7.

### BE-03 — Specialist status was sent to the profile endpoint

Root cause: `UpdateSpecialistDto` did not accept status and there was no activate/deactivate/restore API.

Fix: status remains deliberately absent from general profile update. Dedicated lifecycle endpoints synchronize `Specialist.status` with `User.status`, increment `tokenVersion`, revoke sessions, and write audit logs. Archive preserves all appointments, assessments, progress, and attendance history.

### BE-04/05/06 — Parent update/status/archive contract was incomplete

Root cause: update accepted only name/address, Parent had no lifecycle endpoints, and the linked User identity was not updated.

Fix: update now handles normalized linked-User phone atomically; duplicate phone returns 409. Parent lifecycle uses `User.status` as its single source of truth. Archive is soft-only and default lists hide archived records. `DELETE /parents/:id` is a compatibility alias to archive and performs no hard delete.

### BE-07/08 — Admin and unified lifecycle gaps

Root cause: Admin archive used `BLOCKED`, restore/activate/deactivate routes were absent, and ordinary lists exposed archived rows.

Fix: added explicit lifecycle routes and `UserStatus.ARCHIVED`. Security changes invalidate sessions. The current Super Admin cannot remove its own access; the last active Super Admin check runs in a Serializable transaction to protect the invariant under concurrency.

### BE-09 — Specialist working days were not modeled

Root cause: no Specialist field or appointment validation existed.

Fix: `Specialist.workingDays Int[]` defaults to all ISO weekdays. DTOs validate unique integers 1–7 and sort output canonically. Appointment create/reschedule calculates the weekday in `CenterSettings.timezone` (default `Asia/Tashkent`) and rejects non-working days.

### BE-10/11/12 — Migration, seeder, errors, and regression coverage

Fix: migration preflight blocks missing/non-canonical/duplicate phone identities instead of guessing. Employee phones become unique. Seeder is idempotent, includes Specialist bio/workdays and three Employee lifecycle fixtures. Strict whitelist stays enabled. Field/business errors remain 400; auth 401; RBAC 403; missing rows 404; duplicate phones and invalid transitions 409.

Password recovery decision: deliberately blocked/documented. There is no insecure email fallback or fake SMS endpoint. An OTP-backed SMS challenge store/provider must be approved before exposing recovery.

## Database migration

Migration: `prisma/migrations/20261024120000_phone_identity_and_user_lifecycle/migration.sql`.

It performs, in order:

1. Read-only preflight assertions for missing, non-canonical, and duplicate User/Employee phones.
2. Adds `ARCHIVED` to `UserStatus`.
3. Drops the User email index and User/Employee email columns.
4. Adds Specialist ISO working days with a seven-day default.
5. Replaces the Employee phone index with a unique index.

Production procedure: run the read-only data-integrity audit, resolve every reported identity manually, take a verified backup, rehearse migration/rollback on a production snapshot, then run `prisma migrate deploy` in an approved window. Do not reset or automatically normalize production identities.

## Seeder

The development/test seeder remains guarded to localhost/approved test schemas and refuses production. It creates seven unique phone-based User accounts, two Specialists with explicit bio/workdays, and three phone-only Employee fixtures covering `ACTIVE`, `INACTIVE`, and `ARCHIVED`. A second seed uses upsert and creates no duplicates. Existing payment/ledger/debt invariants are re-verified.

## Frontend contract

The authoritative payloads, responses, lifecycle endpoints, status table, and recovery decision are documented in `docs/frontend-api-contract.md`.

Frontend actions required:

- Remove `email` from all account/profile forms and request mappers.
- Send Parent phone through `PATCH /parents/:id`.
- Send Parent/Specialist status only through the dedicated status endpoint.
- Map ordinary Parent delete to `DELETE /parents/:id` or `POST /parents/:id/archive`; both are soft archive.
- Use ISO weekday integers 1–7 for Specialist workdays.
- Treat 409 duplicate-phone responses as a field conflict; never silently merge accounts.

## Security and regression result

- Phone login normalization: PASS.
- Non-active login denial: PASS.
- Old access/refresh session invalidation after lifecycle changes: PASS.
- RBAC on Admin lifecycle: PASS.
- Last-active-Super-Admin protection: PASS.
- Strict DTO whitelist retained: PASS.
- Parent financial/clinical relationship preservation on archive: PASS.
- Inactive/non-working Specialist appointment rejection: PASS.
- Payment/ledger regression flow: PASS.
- Refresh rotation/replay/logout regression flow: PASS.

## Verification

| Check | Result |
|---|---|
| Prisma generate/validate | PASS |
| Full nine-migration chain in isolated PostgreSQL schema | PASS |
| Seeder run twice/idempotency | PASS |
| TypeScript typecheck | PASS |
| ESLint (`--max-warnings=0`) | PASS |
| Unit/regression | PASS — 16 suites, 112 tests |
| Integration/E2E | PASS — 1 suite, 41 tests |
| Production build | PASS |

The only tooling notice is Prisma's existing `package.json#prisma` seed configuration deprecation for the future Prisma 7 migration; it does not fail Prisma 6 validation or this release.

## System Architect roast

The old contract carried email through the database, DTOs, Swagger, seed, and responses while the product had already decided phone was the identity. That is not a contract; it is five layers independently remembering different versions of reality. Status handling was equally theatrical: archive meant BLOCKED in one place, profile update rejected status in another, and restore simply did not exist. Production would have learned the intended semantics from support tickets.

The corrected design has one User identity, explicit role-profile lifecycles, audited session revocation, safe soft archive, and a migration that refuses to invent identities. This code is now coherent enough for staging. Production deployment remains blocked until real phone data passes preflight and an approved snapshot rehearsal succeeds.

## Sprint closure

- `BE-01` phone-only identity: done.
- `BE-02/03/09` Specialist create/status/workdays: done.
- `BE-04/05/06` Parent update/lifecycle/archive: done.
- `BE-07/08` Admin/RBAC/unified lifecycle: done.
- `BE-10` migration/seeder: done, production deploy intentionally not performed.
- `BE-11` error contract: done.
- `BE-12` security/regression suite: done.

Remaining release ticket: execute the production phone preflight and migration rehearsal against a sanitized production snapshot, with rollback evidence and change approval.
