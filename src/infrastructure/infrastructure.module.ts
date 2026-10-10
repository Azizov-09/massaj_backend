import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppConfiguration } from '../config/configuration';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { RedisHealthService } from './redis/redis-health.service';
import { HttpSmsProvider } from './sms/http-sms.provider';
import { OutboxProcessor } from './outbox/outbox.processor';
import { OutboxService } from './outbox/outbox.service';
import { RealtimeGateway } from './realtime/realtime.gateway';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration>) => ({
        secret: config.getOrThrow('jwt.accessSecret', { infer: true }),
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration>) => {
        const url = new URL(config.getOrThrow('redisUrl', { infer: true }));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: 'outbox' }),
  ],
  providers: [
    RedisHealthService,
    HttpSmsProvider,
    OutboxService,
    OutboxProcessor,
    RealtimeGateway,
  ],
  exports: [RedisHealthService, RealtimeGateway],
})
export class InfrastructureModule {}
