-- Add explicit clinical event timestamps without changing historical meaning.
-- Existing rows inherit their original creation timestamps.
ALTER TABLE "Assessment" ADD COLUMN "assessedAt" TIMESTAMP(3);
UPDATE "Assessment" SET "assessedAt" = "createdAt" WHERE "assessedAt" IS NULL;
ALTER TABLE "Assessment" ALTER COLUMN "assessedAt" SET NOT NULL;
ALTER TABLE "Assessment" ALTER COLUMN "assessedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ProgressEntry" ADD COLUMN "occurredAt" TIMESTAMP(3);
ALTER TABLE "ProgressEntry" ADD COLUMN "createdById" UUID;
UPDATE "ProgressEntry" SET "occurredAt" = "createdAt" WHERE "occurredAt" IS NULL;
ALTER TABLE "ProgressEntry" ALTER COLUMN "occurredAt" SET NOT NULL;
ALTER TABLE "ProgressEntry" ALTER COLUMN "occurredAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Assessment_assessedAt_idx" ON "Assessment"("assessedAt");
CREATE INDEX "ProgressEntry_occurredAt_idx" ON "ProgressEntry"("occurredAt");
CREATE INDEX "ProgressEntry_createdById_idx" ON "ProgressEntry"("createdById");

ALTER TABLE "ProgressEntry"
ADD CONSTRAINT "ProgressEntry_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
