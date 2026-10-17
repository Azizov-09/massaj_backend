import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import {
  ClinicalListQueryDto,
  CreateAssessmentDto,
  CreateAttendanceDto,
  CreateProgressDto,
  UpdateAssessmentDto,
  UpdateAttendanceDto,
  UpdateProgressDto,
} from './dto/clinical.dto';
import { ClinicalService } from './clinical.service';

@ApiTags('Clinical Records')
@ApiBearerAuth()
@Controller()
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post('attendance')
  @ApiOperation({ summary: 'Record Attendance for Child' })
  @ApiResponse({ status: 201, description: 'Attendance record created.' })
  attendance(@Body() dto: CreateAttendanceDto, @CurrentUser() user: RequestUser) {
    return this.clinical.attendance(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Patch('attendance/:id')
  @ApiOperation({ summary: 'Update Attendance Status or Notes' })
  @ApiParam({ name: 'id', description: 'Attendance UUID' })
  @ApiResponse({ status: 200, description: 'Attendance updated.' })
  updateAttendance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAttendanceDto, @CurrentUser() user: RequestUser) {
    return this.clinical.updateAttendance(id, dto, user);
  }

  @Get('children/:childId/attendance')
  @ApiOperation({ summary: 'List Attendance records for a Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of attendance records.' })
  attendances(@Param('childId', ParseUUIDPipe) childId: string, @CurrentUser() user: RequestUser) {
    return this.clinical.attendances(childId, user);
  }

  @Get('children/:childId/assessments')
  @ApiOperation({ summary: 'List Clinical Assessments for a Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of assessments.' })
  assessments(@Param('childId', ParseUUIDPipe) childId: string, @CurrentUser() user: RequestUser) {
    return this.clinical.assessments(childId, user);
  }

  @Get('assessments')
  @ApiOperation({ summary: 'List Accessible Assessments With Child And Specialist Identities' })
  listAssessments(@Query() query: ClinicalListQueryDto, @CurrentUser() user: RequestUser) {
    return this.clinical.listAssessments(query, user);
  }

  @Get('assessments/:id')
  @ApiOperation({ summary: 'Get Assessment Details With Relations' })
  assessmentById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.clinical.assessmentById(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post('assessments')
  @ApiOperation({ summary: 'Create Clinical Assessment' })
  @ApiResponse({ status: 201, description: 'Assessment created.' })
  assessment(@Body() dto: CreateAssessmentDto, @CurrentUser() user: RequestUser) {
    return this.clinical.createAssessment(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Patch('assessments/:id')
  @ApiOperation({ summary: 'Update Clinical Assessment' })
  @ApiParam({ name: 'id', description: 'Assessment UUID' })
  @ApiResponse({ status: 200, description: 'Assessment updated.' })
  updateAssessment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssessmentDto, @CurrentUser() user: RequestUser) {
    return this.clinical.updateAssessment(id, dto, user);
  }

  @Get('children/:childId/progress')
  @ApiOperation({ summary: 'Get Child Developmental Progress Milestones' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of progress milestones.' })
  progress(@Param('childId', ParseUUIDPipe) childId: string, @CurrentUser() user: RequestUser) {
    return this.clinical.progress(childId, user);
  }

  @Get('progress')
  @ApiOperation({ summary: 'List Accessible Progress Records With Child And Specialist Identities' })
  listProgress(@Query() query: ClinicalListQueryDto, @CurrentUser() user: RequestUser) {
    return this.clinical.listProgress(query, user);
  }

  @Get('progress/:id')
  @ApiOperation({ summary: 'Get Progress Details With Relations' })
  progressById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.clinical.progressById(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post('progress')
  @ApiOperation({ summary: 'Log New Progress Milestone' })
  @ApiResponse({ status: 201, description: 'Progress milestone saved.' })
  createProgress(@Body() dto: CreateProgressDto, @CurrentUser() user: RequestUser) {
    return this.clinical.createProgress(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Patch('progress/:id')
  @ApiOperation({ summary: 'Update Progress Milestone' })
  @ApiParam({ name: 'id', description: 'Progress UUID' })
  @ApiResponse({ status: 200, description: 'Progress updated.' })
  updateProgress(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgressDto, @CurrentUser() user: RequestUser) {
    return this.clinical.updateProgress(id, dto, user);
  }

}
