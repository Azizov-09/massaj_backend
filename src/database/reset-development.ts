import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { SEED_DATASET_VERSION, seedDatabase } from './seed';

function loadLocalEnv(): void {
  const content = readFileSync('.env', 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function assertResetTarget(): { url: URL; database: string } {
  if (process.env.NODE_ENV === 'production') throw new Error('Development reset is disabled in production');
  if (process.env.ALLOW_DATABASE_RESET !== 'true') throw new Error('Set ALLOW_DATABASE_RESET=true');
  if (process.env.CONFIRM_SEED_ONLY_DATA !== 'true') throw new Error('Set CONFIRM_SEED_ONLY_DATA=true after data ownership confirmation');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  if (!new Set(['localhost', '127.0.0.1', '::1', '[::1]']).has(url.hostname)) {
    throw new Error('Reset target must be localhost');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (database !== 'child_rehab_crm' && !/(?:_dev|_test)$/.test(database)) {
    throw new Error(`Database "${database}" is not an approved development/test target`);
  }
  if (process.env.CONFIRM_DATABASE_NAME !== database) {
    throw new Error(`CONFIRM_DATABASE_NAME must exactly equal "${database}"`);
  }
  return { url, database };
}

function migrateReset(env: NodeJS.ProcessEnv): void {
  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'reset', '--force', '--skip-seed'],
    { cwd: process.cwd(), env, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Prisma migrate reset failed with exit code ${result.status}`);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const { database } = assertResetTarget();
  const prisma = new PrismaClient();
  const [goalState, payments, users] = await Promise.all([
    prisma.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regclass('"Goal"') IS NOT NULL AS "exists"`,
    prisma.payment.count(),
    prisma.user.count(),
  ]);
  const goalTableExists = goalState[0]?.exists === true;
  const goals = goalTableExists
    ? await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "Goal" ORDER BY "createdAt", "id"`
    : [];
  const inventory = { goals: goals.length, payments, users, goalTableExists };
  const backupPayload = JSON.stringify(
    { database, createdAt: new Date().toISOString(), reason: 'Goals removal before approved development reset', inventory, goals },
    (_, value: unknown) => typeof value === 'bigint' ? value.toString() : value,
    2,
  );
  const checksum = createHash('sha256').update(backupPayload).digest('hex');
  const directory = join(process.cwd(), '.local-backups');
  mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(directory, `goals-${database}-${stamp}.json`);
  writeFileSync(backupPath, backupPayload, { encoding: 'utf8', flag: 'wx' });
  writeFileSync(`${backupPath}.sha256`, `${checksum}  ${backupPath}\n`, { encoding: 'utf8', flag: 'wx' });
  const storedChecksum = createHash('sha256').update(readFileSync(backupPath, 'utf8')).digest('hex');
  if (storedChecksum !== checksum) throw new Error('Goals backup checksum verification failed');
  process.stdout.write(`Goals backup: ${backupPath}\nSHA-256: ${checksum}\n`);
  await prisma.$disconnect();

  const engine = join(process.cwd(), 'node_modules', '@prisma', 'engines', 'schema-engine-windows.exe');
  migrateReset({
    ...process.env,
    NODE_ENV: 'development',
    PRISMA_SCHEMA_ENGINE_BINARY: engine,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  });

  const seeded = new PrismaClient();
  const first = await seedDatabase(seeded);
  const second = await seedDatabase(seeded);
  await seeded.$disconnect();
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Seeder idempotency verification failed');
  process.stdout.write(`Reset and idempotent seed complete (${SEED_DATASET_VERSION}).\n${JSON.stringify(second, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Development reset failed'}\n`);
  process.exitCode = 1;
});
