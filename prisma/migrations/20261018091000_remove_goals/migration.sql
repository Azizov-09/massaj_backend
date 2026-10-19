-- Goal removal is intentionally isolated from all non-destructive schema work.
-- A database that still contains Goal rows must be backed up and explicitly
-- reset/migrated by the guarded development workflow before this can run.
BEGIN;

DO $$
DECLARE
  goal_table REGCLASS;
  goal_count BIGINT;
BEGIN
  goal_table := to_regclass('"Goal"');
  IF goal_table IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM "Goal"' INTO goal_count;
    IF goal_count > 0 THEN
      RAISE EXCEPTION 'Goals removal blocked: % Goal rows remain. Back up and clear them only in an approved environment.', goal_count;
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS "Goal" DROP CONSTRAINT IF EXISTS "Goal_childId_fkey";
ALTER TABLE IF EXISTS "Goal" DROP CONSTRAINT IF EXISTS "Goal_specialistId_fkey";
DROP TABLE IF EXISTS "Goal";
DROP TYPE IF EXISTS "GoalStatus";

COMMIT;
