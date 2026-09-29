import { Module } from '@nestjs/common';
import { DatabaseHealthService } from '../../database/database-health.service';
import { HealthController } from './health.controller';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
@Module({ imports: [InfrastructureModule], controllers: [HealthController], providers: [DatabaseHealthService] }) export class HealthModule {}
