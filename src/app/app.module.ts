import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from '../config/configuration';
import { environmentSchema } from '../config/env.validation';
import { PrismaModule } from '../database/prisma.module';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AuthModule } from '../modules/auth/auth.module';
import { ProfilesModule } from '../modules/profiles/profiles.module';
import { ChildrenModule } from '../modules/children/children.module';
import { ServicesModule } from '../modules/services/services.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { FinanceModule } from '../modules/finance/finance.module';
import { ClinicalModule } from '../modules/clinical/clinical.module';
import { HealthModule } from '../modules/health/health.module';
import { AnnouncementsModule } from '../modules/announcements/announcements.module';
import { PlatformModule } from '../modules/platform/platform.module';
import { PortalsModule } from '../modules/portals/portals.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { AdminsModule } from '../modules/admins/admins.module';
import { EmployeesModule } from '../modules/employees/employees.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: environmentSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    InfrastructureModule,
    AuthModule,
    ProfilesModule,
    ChildrenModule,
    ServicesModule,
    NotificationsModule,
    FinanceModule,
    ClinicalModule,
    HealthModule,
    AnnouncementsModule,
    PlatformModule,
    PortalsModule,
    AnalyticsModule,
    ReportsModule,
    AdminsModule,
    EmployeesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
