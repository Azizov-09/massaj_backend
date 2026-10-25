# MASSAJ CRM Backend Final Integration Audit

Date: 2026-10-25  
Baseline: `03e4472c61bdc3fd6a52a2c00cc766a47dbeae71`  
Scope: appointment identities, attendance identities, service lifecycle, account lifecycle contract, phone-only identity, working days, database integrity, and real-database regression coverage.

## Outcome

The implementation and isolated integration database are PASS. Production was not reset, migrated, or deployed. The configured local `child_rehab_crm.public` database is one migration behind (`20261024120000_phone_identity_and_user_lifecycle`); applying it remains an explicit environment-owner action.

## Root causes and resolutions

| ID | Root cause | Resolution | Status |
|---|---|---|---|
| BE-01 | Appointment list already loaded `child`, `specialist.user`, and `service`. The observed `Noma'lum` is therefore consistent with a frontend key-mapping mismatch, not a missing FK. The API did not expose convenience `fullName` fields. | Preserved the nested contract, added `child.fullName` and `specialist.fullName`, and fail loudly on impossible relation loss instead of substituting a false name. | PASS |
| BE-02 | List and detail used the same include constant but response parity was not regression-tested. | Applied one presenter to create/list/detail/update/status responses and added list-versus-detail E2E assertions. | PASS |
| BE-03 | There was only a child-specific unpaginated history endpoint and portal endpoints; the global Attendance screen had no paginated relation-rich API. | Added RBAC-scoped `GET /attendance` with filters, pagination, child/specialist/appointment/service relations, and canonical names. | PASS |
| BE-04 | Update/archive/restore existed. Archive and restore were documented as 200 but Nest `POST` defaulted to 201; service mutation and activity log were separate writes. | Added explicit 200 responses, UUID parsing, atomic mutation+audit transactions, and real history/archive/reject/restore tests. | PASS |
| BE-05 | Parent/Specialist status routes were being guessed as `/activate` and `/deactivate` by the frontend, while the backend contract is `/status`. | Documented the exact, role-specific lifecycle matrix. Existing RBAC/session-revocation tests remain green. | PASS |
| BE-06 | No active backend email contract remains; only negative regression assertions mention email. | Reconfirmed schema/DTO/seed/response removal, phone login/update/409 behavior, blank specialist bio, and session revocation. | PASS |
| BE-07 | ISO weekday and `Asia/Tashkent` logic already existed and did not require rewriting. | Reconfirmed empty schedule rejection, canonical `[1..7]` persistence, and timezone-aware scheduling via E2E. | PASS |
| BE-08 | Integrity audit lacked appointment/attendance orphan, relation-mismatch, and status-mismatch checks. | Added four read-only SQL diagnostics and made isolated E2E run all 19 checks after HTTP tests. | PASS |
| BE-09 | Appointment identity parity, global attendance, and service lifecycle were not fully covered end-to-end. | Expanded the isolated PostgreSQL E2E suite to 46 tests covering the complete requested chain. | PASS |
| Additional | Announcements created an unsupported `ANNOUNCEMENT_PUBLISHED` outbox event; the worker silently marked unknown types processed. | Removed the no-op event and made the worker reject/record unsupported types. Added a unit regression test. | PASS |

## Canonical response shapes

Appointment list items and `GET /appointments/:id` use the same shape:

```json
{
  "id": "appointment-uuid",
  "startAt": "2026-10-24T05:00:00.000Z",
  "endAt": "2026-10-24T05:45:00.000Z",
  "status": "COMPLETED",
  "child": {
    "id": "child-uuid",
    "firstName": "Ali",
    "lastName": "Valiyev",
    "fullName": "Ali Valiyev"
  },
  "specialist": {
    "id": "specialist-uuid",
    "fullName": "Dilnoza Karimova",
    "user": { "fullName": "Dilnoza Karimova" }
  },
  "service": {
    "id": "service-uuid",
    "name": "Bolalar massaji",
    "durationMinutes": 45,
    "price": 150000
  }
}
```

`GET /attendance?page=1&limit=50` returns `{ items, meta }`; each item contains the same `child`, optional `specialist`, and optional `appointment.service` identity objects. Frontend display keys are `child.fullName`, `specialist.fullName`, and `appointment.service.name`.

## Exact endpoint contract

| Purpose | Endpoint |
|---|---|
| Appointment list/detail | `GET /appointments`, `GET /appointments/:id` |
| Global attendance | `GET /attendance` |
| Child attendance history | `GET /children/:childId/attendance` |
| Service update/archive/restore | `PATCH /services/:id`, `POST /services/:id/archive`, `POST /services/:id/restore` |
| Parent activate/deactivate | `PATCH /parents/:id/status` with `ACTIVE` or `INACTIVE` |
| Parent archive/restore | `POST /parents/:id/archive`, `POST /parents/:id/restore` |
| Specialist activate/deactivate | `PATCH /specialists/:id/status` with `ACTIVE` or `INACTIVE` |
| Specialist archive/restore | `POST /specialists/:id/archive`, `POST /specialists/:id/restore` |
| Admin lifecycle | `POST /admins/:id/activate`, `/deactivate`, `/archive`, `/restore` |
| Employee lifecycle | `POST /employees/:id/activate`, `/deactivate`, `/archive`, `/restore` |

## Database integrity

The disposable PostgreSQL schema applied 9/9 migrations and seeded the development dataset twice to verify idempotency. The post-E2E read-only audit returned 19/19 PASS, including:

- zero orphan or parent-child-invalid appointments;
- zero orphan attendances;
- zero appointment/attendance child or specialist mismatches;
- zero appointment/attendance status mismatches;
- zero invalid phone identities;
- zero payment/ledger relation or amount inconsistencies;
- zero unsupported outbox events.

Historical appointment and `SESSION_CHARGE` rows remained linked and retained their recorded ledger amount while the service was updated, archived, and restored.

## Verification matrix

| Gate | Result |
|---|---|
| `npm run prisma:validate` | PASS |
| `npm run prisma:generate` | PASS |
| Isolated migration deploy | PASS, 9/9 |
| Configured local DB migration status | BLOCKED from automatic action: 1 pending migration |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero warnings |
| `npm test` | PASS, 113/113 |
| `npm run test:e2e:isolated` | PASS, 46/46 plus 19/19 integrity checks |
| `npm run build` | PASS |
| Production migration/deploy | NOT RUN by design |

## Changed files

- `src/modules/appointments/appointments.service.ts`
- `src/modules/clinical/clinical.controller.ts`
- `src/modules/clinical/clinical.service.ts`
- `src/modules/clinical/dto/clinical.dto.ts`
- `src/modules/services/services.controller.ts`
- `src/modules/services/services.service.ts`
- `src/database/data-integrity.audit.ts`
- `src/database/run-isolated-e2e.ts`
- `src/infrastructure/outbox/outbox.processor.ts`
- `src/infrastructure/sms/sms-retry.spec.ts`
- `src/modules/announcements/announcements.service.ts`
- `test/app.e2e-spec.ts`
- `docs/frontend-api-contract.md`

The detailed frontend integration contract is in `docs/frontend-api-contract.md`, sections 17–20.
