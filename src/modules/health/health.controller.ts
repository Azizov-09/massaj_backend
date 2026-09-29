import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseHealthService } from '../../database/database-health.service';
import { Public } from '../../common/decorators/public.decorator';
import { RedisHealthService } from '../../infrastructure/redis/redis-health.service';
@ApiTags('health') @Controller('health') export class HealthController { constructor(private readonly database: DatabaseHealthService, private readonly redis: RedisHealthService) {} @Public() @Get() async check() { const [database, redis] = await Promise.all([this.database.isConnected(), this.redis.isConnected()]); if (!database || !redis) throw new ServiceUnavailableException({ status: 'error', database: database ? 'connected' : 'disconnected', redis: redis ? 'connected' : 'disconnected' }); return { status: 'ok', database: 'connected', redis: 'connected' }; } }
