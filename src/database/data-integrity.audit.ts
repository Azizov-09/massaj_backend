import { Prisma, PrismaClient } from '@prisma/client';

type DiagnosticRow = {
  identifier: string;
  total: number;
};

type DiagnosticCheck = {
  name: string;
  description: string;
  query: Prisma.Sql;
};

const checks: DiagnosticCheck[] = [
  {
    name: 'orphanAssessments',
    description: 'Assessments whose child or specialist relation is missing.',
    query: Prisma.sql`
      SELECT a."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "Assessment" a
      LEFT JOIN "Child" c ON c."id" = a."childId"
      LEFT JOIN "Specialist" s ON s."id" = a."specialistId"
      WHERE c."id" IS NULL OR s."id" IS NULL
      ORDER BY a."id" LIMIT 100`,
  },
  {
    name: 'orphanProgressRecords',
    description: 'Progress records whose child or specialist relation is missing.',
    query: Prisma.sql`
      SELECT p."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "ProgressEntry" p
      LEFT JOIN "Child" c ON c."id" = p."childId"
      LEFT JOIN "Specialist" s ON s."id" = p."specialistId"
      WHERE c."id" IS NULL OR s."id" IS NULL
      ORDER BY p."id" LIMIT 100`,
  },
  {
    name: 'invalidPaymentRelations',
    description: 'Payments missing a child, parent, or matching ChildParent relation.',
    query: Prisma.sql`
      SELECT p."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "Payment" p
      LEFT JOIN "Child" c ON c."id" = p."childId"
      LEFT JOIN "Parent" pr ON pr."id" = p."parentId"
      LEFT JOIN "ChildParent" cp ON cp."childId" = p."childId" AND cp."parentId" = p."parentId"
      WHERE c."id" IS NULL OR pr."id" IS NULL OR cp."id" IS NULL
      ORDER BY p."id" LIMIT 100`,
  },
  {
    name: 'paymentLedgerInconsistencies',
    description: 'Payments without exactly one matching PAYMENT ledger row or with an amount mismatch.',
    query: Prisma.sql`
      SELECT p."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "Payment" p
      LEFT JOIN "Transaction" t ON t."paymentId" = p."id" AND t."type" = 'PAYMENT'
      GROUP BY p."id", p."amount"
      HAVING COUNT(t."id") <> 1
        OR COALESCE(SUM(t."amount"), 0) <> p."amount"
        OR COUNT(t."id") FILTER (
          WHERE t."parentId" IS DISTINCT FROM p."parentId"
            OR t."childId" IS DISTINCT FROM p."childId"
            OR t."direction" <> 'IN'
        ) > 0
      ORDER BY p."id" LIMIT 100`,
  },
  {
    name: 'orphanPaymentLedgerRows',
    description: 'PAYMENT ledger rows without a valid matching Payment or with mismatched ownership/amount.',
    query: Prisma.sql`
      SELECT t."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "Transaction" t
      LEFT JOIN "Payment" p ON p."id" = t."paymentId"
      WHERE t."type" = 'PAYMENT'
        AND (
          p."id" IS NULL
          OR t."parentId" IS DISTINCT FROM p."parentId"
          OR t."childId" IS DISTINCT FROM p."childId"
          OR t."amount" IS DISTINCT FROM p."amount"
          OR t."direction" <> 'IN'
        )
      ORDER BY t."id" LIMIT 100`,
  },
  {
    name: 'invalidFinancialAmounts',
    description: 'Payments or ledger rows containing zero or negative amounts.',
    query: Prisma.sql`
      SELECT issue.identifier, COUNT(*) OVER()::int AS total
      FROM (
        SELECT ('payment:' || "id"::text) AS identifier FROM "Payment" WHERE "amount" <= 0
        UNION ALL
        SELECT ('transaction:' || "id"::text) AS identifier FROM "Transaction" WHERE "amount" <= 0
      ) issue
      ORDER BY issue.identifier LIMIT 100`,
  },
  {
    name: 'duplicateFinancialIdempotencyKeys',
    description: 'Duplicate non-null idempotency keys if database constraints were bypassed.',
    query: Prisma.sql`
      SELECT issue.identifier, COUNT(*) OVER()::int AS total
      FROM (
        SELECT ('payment:' || "idempotencyKey") AS identifier
        FROM "Payment" WHERE "idempotencyKey" IS NOT NULL
        GROUP BY "idempotencyKey" HAVING COUNT(*) > 1
        UNION ALL
        SELECT ('transaction:' || "idempotencyKey") AS identifier
        FROM "Transaction" WHERE "idempotencyKey" IS NOT NULL
        GROUP BY "idempotencyKey" HAVING COUNT(*) > 1
      ) issue
      ORDER BY issue.identifier LIMIT 100`,
  },
  {
    name: 'invalidPaymentNotifications',
    description: 'Payment-success notifications that reference a missing payment.',
    query: Prisma.sql`
      SELECT n."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "Notification" n
      LEFT JOIN "Payment" p ON p."id" = n."relatedEntityId"
      WHERE n."type" = 'PAYMENT'
        AND n."relatedEntity" = 'Payment'
        AND (n."relatedEntityId" IS NULL OR p."id" IS NULL)
      ORDER BY n."id" LIMIT 100`,
  },
  {
    name: 'futureClinicalRecords',
    description: 'Assessments or completed progress records dated in the future.',
    query: Prisma.sql`
      SELECT issue.identifier, COUNT(*) OVER()::int AS total
      FROM (
        SELECT ('assessment:' || "id"::text) AS identifier FROM "Assessment" WHERE "assessedAt" > NOW()
        UNION ALL
        SELECT ('progress:' || "id"::text) AS identifier FROM "ProgressEntry" WHERE "occurredAt" > NOW()
      ) issue
      ORDER BY issue.identifier LIMIT 100`,
  },
  {
    name: 'goalsPendingArchive',
    description: 'Historical Goal rows that require an approved archive/drop decision.',
    query: Prisma.sql`
      SELECT g."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "Goal" g ORDER BY g."id" LIMIT 100`,
  },
  {
    name: 'unsupportedOutboxEvents',
    description: 'Legacy outbox events for which the current worker has no handler.',
    query: Prisma.sql`
      SELECT o."id"::text AS identifier, COUNT(*) OVER()::int AS total
      FROM "OutboxEvent" o
      WHERE o."eventType" NOT IN ('SEND_SMS_NOTIFICATION')
      ORDER BY o."id" LIMIT 100`,
  },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.PRODUCTION_DIAGNOSTICS_APPROVED !== 'true') {
    throw new Error(
      'Production diagnostics require explicit approval: set PRODUCTION_DIAGNOSTICS_APPROVED=true for this read-only run.',
    );
  }

  const prisma = new PrismaClient();
  try {
    const clinicalColumns = await prisma.$queryRaw<Array<{ tableName: string; columnName: string }>>(Prisma.sql`
      SELECT table_name AS "tableName", column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'Assessment' AND column_name = 'assessedAt')
          OR (table_name = 'ProgressEntry' AND column_name = 'occurredAt'))`);
    const goalState = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT to_regclass('"Goal"') IS NOT NULL AS "exists"`);
    const goalTableExists = goalState[0]?.exists === true;
    const hasAssessedAt = clinicalColumns.some(
      (column) => column.tableName === 'Assessment' && column.columnName === 'assessedAt',
    );
    const hasOccurredAt = clinicalColumns.some(
      (column) => column.tableName === 'ProgressEntry' && column.columnName === 'occurredAt',
    );
    const legacyFutureClinicalQuery = Prisma.sql`
      SELECT issue.identifier, COUNT(*) OVER()::int AS total
      FROM (
        SELECT ('assessment:' || "id"::text) AS identifier FROM "Assessment" WHERE "createdAt" > NOW()
        UNION ALL
        SELECT ('progress:' || "id"::text) AS identifier FROM "ProgressEntry" WHERE "createdAt" > NOW()
      ) issue
      ORDER BY issue.identifier LIMIT 100`;
    const effectiveChecks = checks.map((check) => {
      if (check.name === 'futureClinicalRecords' && (!hasAssessedAt || !hasOccurredAt)) {
        return { ...check, query: legacyFutureClinicalQuery };
      }
      if (check.name === 'goalsPendingArchive' && !goalTableExists) {
        return {
          ...check,
          description: 'Retired Goal table is absent.',
          query: Prisma.sql`SELECT NULL::text AS identifier, 0::int AS total WHERE FALSE`,
        };
      }
      return check;
    });
    const results: Array<Record<string, unknown> & { status: string; total: number }> = [{
      check: 'clinicalTimestampMigrationState',
      description: 'Required assessedAt and occurredAt database columns are deployed.',
      status: hasAssessedAt && hasOccurredAt ? 'PASS' : 'ISSUES_FOUND',
      total: Number(!hasAssessedAt) + Number(!hasOccurredAt),
      sampleIds: [
        ...(!hasAssessedAt ? ['Assessment.assessedAt'] : []),
        ...(!hasOccurredAt ? ['ProgressEntry.occurredAt'] : []),
      ],
      sampleLimit: 2,
    }];
    for (const check of effectiveChecks) {
      try {
        const rows = await prisma.$queryRaw<DiagnosticRow[]>(check.query);
        results.push({
          check: check.name,
          description: check.description,
          status: rows.length > 0 ? 'ISSUES_FOUND' : 'PASS',
          total: rows[0]?.total ?? 0,
          sampleIds: rows.map((row) => row.identifier),
          sampleLimit: 100,
        });
      } catch (error) {
        results.push({
          check: check.name,
          description: check.description,
          status: 'CHECK_FAILED',
          total: 0,
          sampleIds: [],
          sampleLimit: 100,
          error: error instanceof Error ? error.message : 'Unknown query failure',
        });
      }
    }

    const failedChecks = results.filter((result) => result.status !== 'PASS').length;
    process.stdout.write(`${JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
      checks: results.length,
      failedChecks,
      results,
    }, null, 2)}\n`);
    if (failedChecks > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Data integrity audit failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
