import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

class ReportQueryDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsUUID() specialistId?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() childId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 50;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('financial') financial(@Query() q: ReportQueryDto) { return this.reports.financial(q); }
  @Get('attendance') attendance(@Query() q: ReportQueryDto) { return this.reports.attendance(q); }
  @Get('sessions') sessions(@Query() q: ReportQueryDto) { return this.reports.sessions(q); }
  @Get('children') children(@Query() q: ReportQueryDto) { return this.reports.children(q); }
  @Get('specialists') specialists(@Query() q: ReportQueryDto) { return this.reports.specialists(q); }
  @Get('progress') progress(@Query() q: ReportQueryDto) { return this.reports.progress(q); }
  @Get('notifications') notifications(@Query() q: ReportQueryDto) { return this.reports.notifications(q); }
}
