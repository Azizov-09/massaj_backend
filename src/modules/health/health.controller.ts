import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DatabaseHealthService } from '../../database/database-health.service';
import { Public } from '../../common/decorators/public.decorator';
import { RedisHealthService } from '../../infrastructure/redis/redis-health.service';

@ApiTags('Health Probes')
@Controller('health')
export class HealthController {
  constructor(
    private readonly database: DatabaseHealthService,
    private readonly redis: RedisHealthService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'System Liveness & Readiness Probe',
    description: 'Checks live TCP connectivity to PostgreSQL database and Redis cluster.',
  })
  @ApiResponse({ status: 200, description: 'All systems operational (PostgreSQL and Redis connected).' })
  @ApiResponse({ status: 503, description: 'One or more subsystem dependencies are unreachable.' })
  async check() {
    const [database, redis] = await Promise.all([this.database.isConnected(), this.redis.isConnected()]);
    if (!database || !redis) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: database ? 'connected' : 'disconnected',
        redis: redis ? 'connected' : 'disconnected',
      });
    }
    return { status: 'ok', database: 'connected', redis: 'connected' };
  }
}
