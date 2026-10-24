-- This migration deliberately refuses to guess or rewrite account identities.
-- Resolve every reported row before deploying it to a production database.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "phone" IS NULL OR BTRIM("phone") = ''
  ) THEN
    RAISE EXCEPTION 'PHONE_IDENTITY_PREFLIGHT: User rows with a missing phone must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "phone" !~ '^\+998[0-9]{9}$'
  ) THEN
    RAISE EXCEPTION 'PHONE_IDENTITY_PREFLIGHT: non-canonical User phone values must be reviewed and normalized before migration';
  END IF;

  IF EXISTS (
    SELECT "phone" FROM "User"
    GROUP BY "phone" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PHONE_IDENTITY_PREFLIGHT: duplicate User phones must be resolved before migration';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Employee"
    WHERE "phone" IS NULL OR BTRIM("phone") = '' OR "phone" !~ '^\+998[0-9]{9}$'
  ) THEN
    RAISE EXCEPTION 'PHONE_IDENTITY_PREFLIGHT: missing or non-canonical Employee phones must be reviewed before migration';
  END IF;

  IF EXISTS (
    SELECT "phone" FROM "Employee"
    GROUP BY "phone" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'PHONE_IDENTITY_PREFLIGHT: duplicate Employee phones must be resolved before migration';
  END IF;
END $$;

-- User-level lifecycle is the source of truth for Admin and Parent accounts.
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

-- Email is no longer an account or profile attribute anywhere in MASSAJ CRM.
DROP INDEX IF EXISTS "User_email_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "email";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "email";

-- Canonical ISO weekdays: 1=Monday ... 7=Sunday.
ALTER TABLE "Specialist"
ADD COLUMN "workingDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7]::INTEGER[];

DROP INDEX IF EXISTS "Employee_phone_idx";
CREATE UNIQUE INDEX "Employee_phone_key" ON "Employee"("phone");
