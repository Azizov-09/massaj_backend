import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppConfiguration } from '../../config/configuration';
@Injectable()
export class RedisHealthService {
  constructor(private readonly config: ConfigService<AppConfiguration>) {}
  async isConnected(): Promise<boolean> { const connection = new Redis(this.config.getOrThrow('redisUrl', { infer: true }), { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 0, enableOfflineQueue: false }); try { await connection.connect(); return await connection.ping() === 'PONG'; } catch { return false; } finally { connection.disconnect(); } }
}
