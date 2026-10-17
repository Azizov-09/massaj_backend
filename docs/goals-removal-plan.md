# Goals Module Removal Plan

## Current state

Runtime Goals endpoints, DTOs, service methods, portal queries, and seed creation have been removed. The `Goal` table, `GoalStatus` enum, and Prisma relations remain intentionally present so historical data is not destroyed without approval.

## Pre-migration read-only checks

1. Run `npm run audit:data-integrity` against staging with a read-only database account.
2. Record Goal row count and verify every Goal points to an existing Child and Specialist.
3. Confirm no application, report, external integration, or direct SQL consumer reads `Goal`.
4. Export historical Goal rows with checksums to approved encrypted storage.
5. Obtain written approval naming the environment, row count, backup location, maintenance window, and rollback owner.

## Proposed destructive migration — not created or approved

After approval only:

1. Create an immutable `GoalArchive` table or approved external archive.
2. Copy all Goal rows and verify source/archive counts and checksums.
3. Deploy runtime code without Goals dependencies and observe for at least one release window.
4. Drop `Goal` foreign keys, indexes, table, `GoalStatus`, and Prisma relations in a dedicated migration.
5. Run clinical, children, attendance, portal, analytics, and report regression suites.

## Rollback

Before the destructive migration, retain a point-in-time database backup. Rollback recreates the enum/table/indexes/foreign keys, restores archived rows, verifies row counts/checksums, then redeploys the previous compatible application version. A rollback must not invent or silently discard historical clinical data.

## Approval gate

The destructive migration must not be generated, applied, or deployed until the user explicitly approves production data removal. Current completion criterion is therefore: runtime API absent, dependency audit clean, archive/drop plan documented, database data retained.
