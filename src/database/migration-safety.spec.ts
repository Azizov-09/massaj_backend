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

  it('keeps the integrity audit implementation read-only', () => {
    const source = read('src/database/data-integrity.audit.ts');
    expect(source).not.toMatch(/\.\s*(create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/i);
    expect(source).not.toMatch(/\$executeRaw|Prisma\.sql`\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b/i);
  });
});
