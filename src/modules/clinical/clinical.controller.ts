import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateAssessmentDto, CreateAttendanceDto, CreateGoalDto, CreateProgressDto, UpdateAssessmentDto, UpdateAttendanceDto, UpdateGoalDto, UpdateProgressDto } from './dto/clinical.dto';
import { ClinicalService } from './clinical.service';
@ApiTags('clinical records') @ApiBearerAuth() @Controller()
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post('attendance') attendance(@Body() dto: CreateAttendanceDto, @CurrentUser() user: RequestUser) { return this.clinical.attendance(dto, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Patch('attendance/:id') updateAttendance(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @CurrentUser() user: RequestUser) { return this.clinical.updateAttendance(id, dto, user); }
  @Get('children/:childId/assessments') assessments(@Param('childId') childId: string, @CurrentUser() user: RequestUser) { return this.clinical.assessments(childId, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post('assessments') assessment(@Body() dto: CreateAssessmentDto, @CurrentUser() user: RequestUser) { return this.clinical.createAssessment(dto, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Patch('assessments/:id') updateAssessment(@Param('id') id: string, @Body() dto: UpdateAssessmentDto, @CurrentUser() user: RequestUser) { return this.clinical.updateAssessment(id, dto, user); }
  @Get('children/:childId/progress') progress(@Param('childId') childId: string, @CurrentUser() user: RequestUser) { return this.clinical.progress(childId, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post('progress') createProgress(@Body() dto: CreateProgressDto, @CurrentUser() user: RequestUser) { return this.clinical.createProgress(dto, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Patch('progress/:id') updateProgress(@Param('id') id: string, @Body() dto: UpdateProgressDto, @CurrentUser() user: RequestUser) { return this.clinical.updateProgress(id, dto, user); }
  @Get('children/:childId/goals') goals(@Param('childId') childId: string, @CurrentUser() user: RequestUser) { return this.clinical.goals(childId, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post('goals') createGoal(@Body() dto: CreateGoalDto, @CurrentUser() user: RequestUser) { return this.clinical.createGoal(dto, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Patch('goals/:id') updateGoal(@Param('id') id: string, @Body() dto: UpdateGoalDto, @CurrentUser() user: RequestUser) { return this.clinical.updateGoal(id, dto, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post('goals/:id/complete') completeGoal(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.clinical.completeGoal(id, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post('goals/:id/pause') pauseGoal(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.clinical.pauseGoal(id, user); }
}
