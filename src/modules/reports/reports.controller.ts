import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by specialist UUID' })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiPropertyOptional({ description: 'Filter by parent UUID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Filter by child UUID' })
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({ description: 'Filter by specific status string' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 50;
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('financial')
  @ApiOperation({ summary: 'Financial Reconciliation Report' })
  @ApiResponse({ status: 200, description: 'Aggregated financial report.' })
  financial(@Query() q: ReportQueryDto) {
    return this.reports.financial(q);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance & No-Show Rate Report' })
  @ApiResponse({ status: 200, description: 'Attendance metrics and log.' })
  attendance(@Query() q: ReportQueryDto) {
    return this.reports.attendance(q);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Rehabilitation Sessions Volume Report' })
  @ApiResponse({ status: 200, description: 'Clinical sessions report.' })
  sessions(@Query() q: ReportQueryDto) {
    return this.reports.sessions(q);
  }

  @Get('children')
  @ApiOperation({ summary: 'Enrolled Children Demographics & Intake Report' })
  @ApiResponse({ status: 200, description: 'Children intake report.' })
  children(@Query() q: ReportQueryDto) {
    return this.reports.children(q);
  }

  @Get('specialists')
  @ApiOperation({ summary: 'Specialist Workload & Performance Report' })
  @ApiResponse({ status: 200, description: 'Specialist caseload report.' })
  specialists(@Query() q: ReportQueryDto) {
    return this.reports.specialists(q);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Rehabilitation Progress & Milestone Completion Report' })
  @ApiResponse({ status: 200, description: 'Milestones achieved report.' })
  progress(@Query() q: ReportQueryDto) {
    return this.reports.progress(q);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'System Notifications & SMS Dispatch Report' })
  @ApiResponse({ status: 200, description: 'Notification audit report.' })
  notifications(@Query() q: ReportQueryDto) {
    return this.reports.notifications(q);
  }
}
