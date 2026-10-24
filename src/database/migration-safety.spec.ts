import { readFileSync } from 'fs';
import { join } from 'path';

describe('clinical migration and Goals removal safety', () => {
  const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

  it('keeps the clinical timestamp migration non-destructive and backfills existing rows', () => {
    const sql = read('prisma/migrations/20261017090000_add_clinical_event_dates/migration.sql');

    expect(sql).not.toMatch(/^\s*(DROP\s|DELETE\s+FROM\s|TRUNCATE\s)/im);
    expect(sql).toContain('UPDATE "Assessment" SET "assessedAt" = "createdAt"');
    expect(sql).toContain('UPDATE "ProgressEntry" SET "occurredAt" = "createdAt"');
    expect(sql).toContain('ON DELETE SET NULL');
  });

  it('has no active Goals route, service query, DTO, portal query, or seed creation', () => {
    const runtimeFiles = [
      'src/modules/clinical/clinical.controller.ts',
      'src/modules/clinical/clinical.service.ts',
      'src/modules/clinical/dto/clinical.dto.ts',
      'src/modules/portals/portals.controller.ts',
      'src/modules/portals/portals.service.ts',
      'src/common/services/access.service.ts',
      'src/modules/children/children.service.ts',
      'src/database/seed.ts',
    ];

    for (const file of runtimeFiles) {
      expect(read(file)).not.toMatch(/\bgoals?\b/i);
    }
  });

  it('isolates non-destructive appointment/finance DDL from the guarded Goals drop', () => {
    const nonDestructive = read(
      'prisma/migrations/20261018090000_restore_appointments_and_finance_integrity/migration.sql',
    );
    const goalsDrop = read('prisma/migrations/20261018091000_remove_goals/migration.sql');

    expect(nonDestructive).toContain('CREATE TABLE "Appointment"');
    expect(nonDestructive).toContain('Transaction_payment_once_key');
    expect(nonDestructive).toContain('ALTER COLUMN "idempotencyKey" TYPE VARCHAR(512)');
    expect(read('prisma/schema.prisma')).toContain('idempotencyKey String?              @unique @db.VarChar(512)');
    expect(nonDestructive).not.toMatch(/DROP\s+(TABLE|TYPE).*Goal/i);
    expect(goalsDrop).toContain(`to_regclass('"Goal"')`);
    expect(goalsDrop).toContain('Goal rows remain');
    expect(goalsDrop).toContain('DROP TABLE IF EXISTS "Goal"');
    expect(goalsDrop).not.toContain('CREATE TABLE "Appointment"');
  });

  it('requires explicit development reset confirmation and verifies the Goals backup checksum', () => {
    const source = read('src/database/reset-development.ts');
    expect(source).toContain("ALLOW_DATABASE_RESET !== 'true'");
    expect(source).toContain("CONFIRM_SEED_ONLY_DATA !== 'true'");
    expect(source).toContain('CONFIRM_DATABASE_NAME');
    expect(source).toContain('storedChecksum !== checksum');
  });

  it('keeps the integrity audit implementation read-only', () => {
    const source = read('src/database/data-integrity.audit.ts');
    expect(source).not.toMatch(/\.\s*(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/i);
    expect(source).not.toMatch(/\$executeRaw|Prisma\.sql`\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/i);
  });

  it('blocks the phone-only identity migration until legacy identities are safe', () => {
    const sql = read(
      'prisma/migrations/20261024120000_phone_identity_and_user_lifecycle/migration.sql',
    );
    const preflight = sql.indexOf('PHONE_IDENTITY_PREFLIGHT');
    const dropUserEmail = sql.indexOf('ALTER TABLE "User" DROP COLUMN');
    const dropEmployeeEmail = sql.indexOf('ALTER TABLE "Employee" DROP COLUMN');

    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(dropUserEmail).toBeGreaterThan(preflight);
    expect(dropEmployeeEmail).toBeGreaterThan(preflight);
    expect(sql).toContain('duplicate User phones must be resolved');
    expect(sql).toContain('duplicate Employee phones must be resolved');
    expect(sql).toContain('CREATE UNIQUE INDEX "Employee_phone_key"');
  });
});
