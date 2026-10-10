import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

const PERIODS = ['today', 'yesterday', 'last7Days', 'thisWeek', 'thisMonth', 'lastMonth', 'thisYear'] as const;

class PeriodQueryDto {
  @ApiPropertyOptional({
    enum: PERIODS,
    default: 'thisMonth',
    description: 'Predefined time period',
  })
  @IsOptional()
  @IsString()
  @IsIn(PERIODS)
  period: 'today' | 'yesterday' | 'last7Days' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' = 'thisMonth';

  @ApiPropertyOptional({ description: 'Custom start date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Custom end date (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'High-Level Executive Dashboard KPIs' })
  @ApiResponse({ status: 200, description: 'Executive dashboard KPI metrics.' })
  dashboard() {
    return this.analytics.dashboard();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue & Financial Analytics' })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  @ApiResponse({ status: 200, description: 'Revenue breakdowns.' })
  revenue(@Query() query: PeriodQueryDto) {
    return this.analytics.revenue(query.period, query.from, query.to);
  }

  @Get('debt')
  @ApiOperation({ summary: 'Family Receivables & Debt Trends' })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  @ApiResponse({ status: 200, description: 'Debt analysis.' })
  debt(@Query() query: PeriodQueryDto) {
    return this.analytics.debt(query.period);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance Distribution & Specialist Volume Analytics' })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  @ApiResponse({ status: 200, description: 'Attendance volume and distribution.' })
  attendance(@Query() query: PeriodQueryDto) {
    return this.analytics.attendance(query.period);
  }

  @Get('children')
  @ApiOperation({ summary: 'Child Patient Demographics & Intake Trends' })
  @ApiQuery({ name: 'period', required: false, enum: PERIODS })
  @ApiResponse({ status: 200, description: 'Children demographics.' })
  children(@Query() query: PeriodQueryDto) {
    return this.analytics.children(query.period);
  }

  @Get('specialists')
  @ApiOperation({ summary: 'Specialist Performance & Caseload Analytics' })
  @ApiResponse({ status: 200, description: 'Specialist metrics.' })
  specialists() {
    return this.analytics.specialists();
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Notification & SMS Dispatch Success Rates' })
  @ApiResponse({ status: 200, description: 'Notification statistics.' })
  notificationStats() {
    return this.analytics.notificationStats();
  }
}
