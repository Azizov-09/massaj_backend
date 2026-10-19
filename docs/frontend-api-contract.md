# Massaj CRM Backend Contract

Status: finalization contract for the current backend worktree.

Base URL: `/api/v1`. Protected endpoints require `Authorization: Bearer <accessToken>`. Monetary values are positive whole UZS integers; clients must not multiply or divide them by 100.

## 1. Create payment

`POST /payments` — roles: `SUPER_ADMIN`, `ADMIN`.

```json
{
  "parentId": "parent-profile-uuid",
  "childId": "child-uuid",
  "amount": 150000,
  "method": "CASH",
  "note": "Optional operator note",
  "paidAt": "2026-10-17T10:00:00.000Z",
  "idempotencyKey": "client-generated-unique-key"
}
```

`parentId` should be the Parent profile UUID. A User UUID is temporarily resolved for backward compatibility. `amount` must be an integer from 1 through 2,000,000,000. `idempotencyKey` is required, 8–255 characters, and must be reused only when retrying the identical logical request.

## 2. Payment success

Status `201`. The response is the committed Payment row; success is never returned before the Payment, ledger transaction, notification, and audit log transaction commits.

```json
{
  "id": "payment-uuid",
  "parentId": "parent-profile-uuid",
  "childId": "child-uuid",
  "amount": 150000,
  "method": "CASH",
  "note": "Optional operator note",
  "idempotencyKey": "client-generated-unique-key",
  "paidAt": "2026-10-17T10:00:00.000Z",
  "createdAt": "2026-10-17T10:00:01.000Z"
}
```

An identical retry returns the existing payment. Reusing the same key for a different parent, child, amount, or method returns `409`.

## 3. Validation error

```json
{
  "statusCode": 400,
  "timestamp": "2026-10-17T10:00:00.000Z",
  "path": "/api/v1/payments",
  "message": ["childId must be a UUID"],
  "error": "Bad Request"
}
```

Validation failures, future payment dates, and invalid parent-child relations are final until the request is corrected. Do not show a success toast for any non-2xx response.

Failed payment requests are not persisted as Payment rows. The database transaction rolls back the Payment, ledger row, notification, and audit log together, so failed requests never change balance and never create a success notification.

## 4. Debtor payment

Debtor payment uses the same `POST /payments` request. Obtain `parentId` and `childId` from `GET /debtors`; do not derive either identifier from a display name. Partial and full payments use the real amount received. The ledger calculates the remaining balance/debt atomically.

`GET /debtors` — roles: `SUPER_ADMIN`, `ADMIN`. The response is an array ordered by highest debt first:

```json
[
  {
    "parentId": "parent-profile-uuid",
    "debt": 400000,
    "parent": { "id": "parent-profile-uuid", "user": { "fullName": "Ali Valiyev", "phone": "+998901234567" } },
    "children": [
      { "id": "child-uuid", "firstName": "Umar", "lastName": "Valiyev", "fullName": "Umar Valiyev", "debt": 400000 }
    ]
  }
]
```

## 5. Assessment list and detail

- `GET /assessments?page=1&limit=50&childId=<uuid>&specialistId=<uuid>&from=<ISO>&to=<ISO>`
- `GET /assessments/:id`

```json
{
  "id": "assessment-uuid",
  "childId": "child-uuid",
  "specialistId": "specialist-uuid",
  "assessmentDate": "2026-10-15T09:00:00.000Z",
  "child": { "id": "child-uuid", "firstName": "Umar", "lastName": "Karimov", "fullName": "Umar Karimov" },
  "specialist": { "id": "specialist-uuid", "fullName": "Nilufar Ahmedova", "user": { "fullName": "Nilufar Ahmedova" } }
}
```

List responses wrap records in `{ "items": [], "meta": { "page": 1, "limit": 50, "total": 0, "totalPages": 0 } }`. Access is restricted to administrators, the assigned specialist, or a linked parent.

## 6. Progress list and detail

- `GET /progress?page=1&limit=50&childId=<uuid>&specialistId=<uuid>&from=<ISO>&to=<ISO>`
- `GET /progress/:id`

The relation shape matches assessments, with `progressDate` sourced from `occurredAt`. `specialist` is the treating specialist; `recordedBy` identifies the user who created the record and may be `null` for historical rows. Creating or updating a progress record with a future `occurredAt` returns `400`. Progress records are clinical events and intentionally do not require an appointment identifier.

## 7. Appointment calendar

- `POST /appointments` — roles: `SUPER_ADMIN`, `ADMIN`
- `GET /appointments?page=1&limit=50&childId=<uuid>&specialistId=<uuid>&status=<status>&from=<ISO>&to=<ISO>`
- `GET /appointments/:id`
- `PATCH /appointments/:id`
- `PATCH /appointments/:id/status`

Course appointments use the same non-empty `courseKey` plus unique `sequenceNumber` values. The backend calculates `endAt` from the selected Service duration and rejects overlapping child or specialist appointments.

## 8. Payment list and detail

- `GET /payments` — roles: `SUPER_ADMIN`, `ADMIN`
- `GET /payments/:id` — roles: `SUPER_ADMIN`, `ADMIN`

```json
{
  "id": "payment-uuid",
  "payer": { "id": "parent-profile-uuid", "fullName": "Ali Valiyev", "phone": "+998901234567" },
  "child": { "id": "child-uuid", "firstName": "Umar", "lastName": "Valiyev", "fullName": "Umar Valiyev" },
  "amount": 150000,
  "method": "CASH",
  "paidAt": "2026-10-17T10:00:00.000Z"
}
```

## 9. Notification

`GET /notifications?page=1&limit=50` returns `{ "items": [], "meta": { ... } }` scoped to the authenticated user. The server ignores client-supplied user identifiers.

```json
{
  "id": "notification-uuid",
  "type": "PAYMENT",
  "priority": "NORMAL",
  "title": "Payment received",
  "message": "A payment of 150,000 UZS was recorded.",
  "relatedEntity": "Payment",
  "relatedEntityId": "payment-uuid",
  "readAt": null,
  "createdAt": "2026-10-17T10:00:01.000Z"
}
```

A payment success notification is created inside the same database transaction. Realtime `notification:new` is emitted only after commit.

## 10. Refresh endpoint

`POST /auth/refresh`. Preferred transport is the `refresh_token` HttpOnly cookie with `credentials: "include"`. A body token remains supported during the coordinated migration:

```json
{ "refreshToken": "optional-legacy-token" }
```

Success returns `{ "accessToken": "..." }` and rotates the HttpOnly cookie. The refresh token is intentionally not returned in JSON. Access tokens are bound to the backing session; logout or revocation invalidates them immediately.

Frontend requests must use `credentials: "include"`. Production uses `Secure; SameSite=None`; local HTTP development uses `SameSite=Lax`. `FRONTEND_URL` and optional comma-separated `FRONTEND_ORIGINS` are the only credentialed HTTP/WebSocket origins.

## 11. Status and retry rules

| Status | Meaning | Client action |
|---|---|---|
| 400 | Invalid DTO, relation, date, or business rule | Correct input; do not retry unchanged |
| 401 | Missing, expired, invalid, or revoked session | Attempt one refresh, then return to login |
| 403 | Authenticated but insufficient role/resource ownership | Do not retry; hide/disable the action |
| 404 | Referenced resource does not exist | Refresh local data |
| 409 | Idempotency key conflict or duplicate operation | If request differs, generate a new key; otherwise fetch the existing record |
| 429 | Rate limit exceeded | Retry with exponential backoff |
| 500/503 | Unexpected or dependency failure | Keep the idempotency key and retry with bounded exponential backoff |

Breaking changes in this release are mandatory payment/refund/charge idempotency keys, cookie-only refresh responses, and session-bound access JWTs. Frontend and backend must be released together; users with pre-release access tokens will need to log in again.
