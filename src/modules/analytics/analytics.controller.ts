import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

const PERIODS = ['today', 'yesterday', 'last7Days', 'thisWeek', 'thisMonth', 'lastMonth', 'thisYear'] as const;

class PeriodQueryDto {
  @IsOptional() @IsString() @IsIn(PERIODS) period: 'today' | 'yesterday' | 'last7Days' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' = 'thisMonth';
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard() {
    return this.analytics.dashboard();
  }

  @Get('revenue')
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  revenue(@Query() query: PeriodQueryDto) {
    return this.analytics.revenue(query.period, query.from, query.to);
  }

  @Get('debt')
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  debt(@Query() query: PeriodQueryDto) {
    return this.analytics.debt(query.period);
  }

  @Get('appointments')
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  appointments(@Query() query: PeriodQueryDto) {
    return this.analytics.appointments(query.period);
  }

  @Get('sessions')
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  sessions(@Query() query: PeriodQueryDto) {
    return this.analytics.sessions(query.period);
  }

  @Get('children')
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  children(@Query() query: PeriodQueryDto) {
    return this.analytics.children(query.period);
  }

  @Get('specialists')
  specialists() {
    return this.analytics.specialists();
  }

  @Get('notifications')
  notificationStats() {
    return this.analytics.notificationStats();
  }
}
