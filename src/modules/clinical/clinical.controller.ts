import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import {
  CreateAssessmentDto,
  CreateAttendanceDto,
  CreateGoalDto,
  CreateProgressDto,
  UpdateAssessmentDto,
  UpdateAttendanceDto,
  UpdateGoalDto,
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
  @ApiOperation({ summary: 'Record Attendance for Appointment' })
  @ApiResponse({ status: 201, description: 'Attendance record created.' })
  attendance(@Body() dto: CreateAttendanceDto, @CurrentUser() user: RequestUser) {
    return this.clinical.attendance(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Patch('attendance/:id')
  @ApiOperation({ summary: 'Update Attendance Status or Notes' })
  @ApiParam({ name: 'id', description: 'Attendance UUID' })
  @ApiResponse({ status: 200, description: 'Attendance updated.' })
  updateAttendance(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @CurrentUser() user: RequestUser) {
    return this.clinical.updateAttendance(id, dto, user);
  }

  @Get('children/:childId/assessments')
  @ApiOperation({ summary: 'List Clinical Assessments for a Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of assessments.' })
  assessments(@Param('childId') childId: string, @CurrentUser() user: RequestUser) {
    return this.clinical.assessments(childId, user);
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
  updateAssessment(@Param('id') id: string, @Body() dto: UpdateAssessmentDto, @CurrentUser() user: RequestUser) {
    return this.clinical.updateAssessment(id, dto, user);
  }

  @Get('children/:childId/progress')
  @ApiOperation({ summary: 'Get Child Developmental Progress Milestones' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of progress milestones.' })
  progress(@Param('childId') childId: string, @CurrentUser() user: RequestUser) {
    return this.clinical.progress(childId, user);
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
  updateProgress(@Param('id') id: string, @Body() dto: UpdateProgressDto, @CurrentUser() user: RequestUser) {
    return this.clinical.updateProgress(id, dto, user);
  }

  @Get('children/:childId/goals')
  @ApiOperation({ summary: 'Get Rehabilitation Goals for Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of therapeutic goals.' })
  goals(@Param('childId') childId: string, @CurrentUser() user: RequestUser) {
    return this.clinical.goals(childId, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post('goals')
  @ApiOperation({ summary: 'Define New Therapeutic Goal' })
  @ApiResponse({ status: 201, description: 'Goal created.' })
  createGoal(@Body() dto: CreateGoalDto, @CurrentUser() user: RequestUser) {
    return this.clinical.createGoal(dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Patch('goals/:id')
  @ApiOperation({ summary: 'Update Therapeutic Goal Progress / Details' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiResponse({ status: 200, description: 'Goal updated.' })
  updateGoal(@Param('id') id: string, @Body() dto: UpdateGoalDto, @CurrentUser() user: RequestUser) {
    return this.clinical.updateGoal(id, dto, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post('goals/:id/complete')
  @ApiOperation({ summary: 'Mark Goal As Completed (100%)' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiResponse({ status: 200, description: 'Goal marked as COMPLETED.' })
  completeGoal(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.clinical.completeGoal(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post('goals/:id/pause')
  @ApiOperation({ summary: 'Pause Goal Progress' })
  @ApiParam({ name: 'id', description: 'Goal UUID' })
  @ApiResponse({ status: 200, description: 'Goal paused.' })
  pauseGoal(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.clinical.pauseGoal(id, user);
  }
}
