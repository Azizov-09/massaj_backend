export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  jwt: { accessSecret: string; refreshSecret: string; accessExpiresIn: string; refreshExpiresIn: string };
  cookies: { domain?: string; secure: boolean };
  redisUrl: string;
  throttle: { ttl: number; limit: number };
  sms: { enabled: boolean; provider?: string; apiUrl?: string; apiKey?: string; sender?: string };
}

export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  cookies: { domain: process.env.COOKIE_DOMAIN, secure: process.env.COOKIE_SECURE === 'true' },
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  throttle: { ttl: Number(process.env.THROTTLE_TTL ?? 60_000), limit: Number(process.env.THROTTLE_LIMIT ?? 100) },
  sms: {
    enabled: process.env.SMS_ENABLED === 'true', provider: process.env.SMS_PROVIDER,
    apiUrl: process.env.SMS_API_URL, apiKey: process.env.SMS_API_KEY, sender: process.env.SMS_SENDER,
  },
});
