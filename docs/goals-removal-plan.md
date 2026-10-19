# Goals Removal, Backup, and Rollback Plan

## Current state

Runtime Goals controllers, DTOs, service methods, portal queries, seed creation, Prisma model/relations, and `GoalStatus` are removed. The destructive database change is isolated in `20261018091000_remove_goals`; appointment and finance DDL live in the preceding non-destructive migration.

The Goals migration fails closed while even one `Goal` row remains. Fresh databases and approved development resets reach it with an empty Goal table and can proceed normally.

## Development/test execution

1. Run `npm run audit:data-integrity` and confirm the target is localhost and seed-only.
2. Obtain the data owner's confirmation that no real records must survive.
3. Set the three one-shot process variables; never commit them as enabled:
   - `ALLOW_DATABASE_RESET=true`
   - `CONFIRM_SEED_ONLY_DATA=true`
   - `CONFIRM_DATABASE_NAME=<exact database name>`
4. Run `npm run db:reset:development`.
5. The command exports Goal rows to `.local-backups/`, writes a SHA-256 sidecar, re-reads and verifies the backup, resets migrations, seeds twice, and compares both verified summaries.
6. Run migration status, integrity audit, and isolated E2E again.

The local JSON export is development-only and is excluded from Git. It is not an acceptable production backup.

## Production/staging approval gate

Do not use the reset command outside localhost. Before deleting any non-empty Goals dataset:

1. Take a PostgreSQL point-in-time/full backup and verify restoration in a separate environment.
2. Export the `Goal` table with schema metadata to approved encrypted storage.
3. Record environment, row count, backup URI, checksum, approver, operator, and maintenance window.
4. Verify no application, report, integration, or direct SQL consumer reads Goals.
5. Deploy the Goals-free runtime and observe it for one release window.
6. With explicit approval, archive and clear the Goal rows, then run `prisma migrate deploy`.
7. Re-run the 12-check integrity audit and clinical/children/attendance/portal/analytics/report regression suites.

If rows were not cleared, the migration raises an exception and the transaction rolls back without dropping the table or enum.

## Rollback

Preferred rollback is PostgreSQL point-in-time restore to a new database, verification of row counts/checksums and foreign keys, then traffic cutover plus redeployment of the previous compatible application.

If a logical restore is approved instead, recreate `GoalStatus`, `Goal`, its primary key, child/specialist indexes and foreign keys from the original initialization migration; import the encrypted export; verify every Child/Specialist relation and checksum; then deploy the previous schema/client. Never recreate Goals from guessed or partial business data.
