import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

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

function assertLocal(url: URL, label: string): void {
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  if (!localHosts.has(url.hostname)) {
    throw new Error(`${label} must use localhost for the isolated E2E runner`);
  }
}

function runNode(script: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(), env, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}`);
}

async function main(): Promise<void> {
  loadLocalEnv();
  if (process.env.NODE_ENV === 'production') throw new Error('Isolated E2E runner is disabled in production');
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
    throw new Error('DATABASE_URL and REDIS_URL are required');
  }

  const adminDatabaseUrl = new URL(process.env.DATABASE_URL);
  const redisUrl = new URL(process.env.REDIS_URL);
  assertLocal(adminDatabaseUrl, 'DATABASE_URL');
  assertLocal(redisUrl, 'REDIS_URL');

  const schema = `codex_e2e_${process.pid}_${Date.now()}`;
  if (!/^codex_e2e_\d+_\d+$/.test(schema)) throw new Error('Unsafe generated schema name');
  adminDatabaseUrl.searchParams.delete('schema');
  const testDatabaseUrl = new URL(adminDatabaseUrl.toString());
  testDatabaseUrl.searchParams.set('schema', schema);
  const testRedisUrl = new URL(redisUrl.toString());
  testRedisUrl.pathname = '/15';

  const admin = new PrismaClient({ datasourceUrl: adminDatabaseUrl.toString() });
  const redis = new Redis(testRedisUrl.toString(), { lazyConnect: true, maxRetriesPerRequest: 1 });
  let schemaCreated = false;
  let redisOwned = false;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await redis.connect();
    const existingKeys = await redis.dbsize();
    if (existingKeys !== 0) {
      throw new Error('Local Redis database 15 is not empty; refusing to reuse or flush it');
    }
    redisOwned = true;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl.toString(),
      TEST_DATABASE_URL: testDatabaseUrl.toString(),
      REDIS_URL: testRedisUrl.toString(),
      TEST_REDIS_URL: testRedisUrl.toString(),
      PRISMA_SCHEMA_ENGINE_BINARY: join(
        process.cwd(),
        'node_modules',
        '@prisma',
        'engines',
        process.platform === 'win32' ? 'schema-engine-windows.exe' : 'schema-engine',
      ),
      PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
    };
    runNode(join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js'), ['migrate', 'deploy'], env);
    runNode(join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'), ['prisma/seed.ts'], env);
    runNode(join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'), ['prisma/seed.ts'], env);
    runNode(
      join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js'),
      ['--config', './test/jest-e2e.json', '--runInBand'],
      env,
    );
  } finally {
    if (redisOwned) await redis.flushdb();
    if (redis.status !== 'end') redis.disconnect();
    if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Isolated E2E run failed'}\n`);
  process.exitCode = 1;
});
