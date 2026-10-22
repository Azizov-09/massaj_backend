const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testRedisUrl = process.env.TEST_REDIS_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for E2E tests. Refusing to run destructive cleanup against DATABASE_URL.',
  );
}
if (!testRedisUrl) {
  throw new Error('TEST_REDIS_URL is required for E2E tests. Refusing to use a non-test Redis instance.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.REDIS_URL = testRedisUrl;
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-that-is-different-and-at-least-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_DOMAIN = '';
process.env.LOGIN_THROTTLE_LIMIT = '100';
process.env.LOGIN_THROTTLE_TTL = '60000';
process.env.SUPER_ADMIN_PHONE = '+998900000001';
process.env.SUPER_ADMIN_PASSWORD = 'E2ESuperAdminPassword123!';
process.env.SUPER_ADMIN_FULL_NAME = 'E2E Super Admin';
process.env.SWAGGER_ENABLED = 'false';
