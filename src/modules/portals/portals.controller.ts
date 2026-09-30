import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { PortalsService } from './portals.service';

@ApiTags('Role Portals')
@ApiBearerAuth()
@Controller()
export class PortalsController {
  constructor(private readonly portals: PortalsService) {}

  // PARENT PORTAL
  @Roles(Role.PARENT)
  @Get('parent/my-children')
  @ApiOperation({ summary: 'Parent Portal: My Children' })
  @ApiResponse({ status: 200, description: 'List of children belonging to authenticated parent.' })
  children(@CurrentUser() user: RequestUser) {
    return this.portals.parentChildren(user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/my-appointments')
  @ApiOperation({ summary: 'Parent Portal: My Appointments' })
  @ApiResponse({ status: 200, description: 'Appointments for parent children.' })
  appointments(@CurrentUser() user: RequestUser) {
    return this.portals.parentAppointments(user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/my-sessions')
  @ApiOperation({ summary: 'Parent Portal: My Rehabilitation Sessions' })
  @ApiResponse({ status: 200, description: 'Clinical sessions for parent children.' })
  sessions(@CurrentUser() user: RequestUser) {
    return this.portals.parentSessions(user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/my-assessments')
  @ApiOperation({ summary: 'Parent Portal: My Children Assessments' })
  @ApiResponse({ status: 200, description: 'Clinical assessments for parent children.' })
  assessments(@CurrentUser() user: RequestUser) {
    return this.portals.parentAssessments(user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/my-progress')
  @ApiOperation({ summary: 'Parent Portal: My Children Milestones' })
  @ApiResponse({ status: 200, description: 'Progress milestones for parent children.' })
  progress(@CurrentUser() user: RequestUser) {
    return this.portals.parentProgress(user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/my-goals')
  @ApiOperation({ summary: 'Parent Portal: My Children Goals' })
  @ApiResponse({ status: 200, description: 'Rehabilitation goals for parent children.' })
  goals(@CurrentUser() user: RequestUser) {
    return this.portals.parentGoals(user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/my-payments')
  @ApiOperation({ summary: 'Parent Portal: My Payment History' })
  @ApiResponse({ status: 200, description: 'Payment records made by parent.' })
  payments(@CurrentUser() user: RequestUser) {
    return this.portals.parentPayments(user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/my-balance')
  @ApiOperation({ summary: 'Parent Portal: My Current Balance' })
  @ApiResponse({ status: 200, description: 'Current available monetary credit.' })
  async balance(@CurrentUser() user: RequestUser) {
    const state = await this.portals.parentState(user.id);
    return { balance: state.balance };
  }

  @Roles(Role.PARENT)
  @Get('parent/my-debt')
  @ApiOperation({ summary: 'Parent Portal: My Outstanding Debt' })
  @ApiResponse({ status: 200, description: 'Current negative balance or unpaid services.' })
  async debt(@CurrentUser() user: RequestUser) {
    const state = await this.portals.parentState(user.id);
    return { debt: state.debt };
  }

  // SPECIALIST PORTAL
  @Roles(Role.SPECIALIST)
  @Get('specialist/my-schedule')
  @ApiOperation({ summary: 'Specialist Portal: My Clinical Schedule' })
  @ApiResponse({ status: 200, description: 'Upcoming appointments and timetable.' })
  schedule(@CurrentUser() user: RequestUser) {
    return this.portals.specialistSchedule(user.id);
  }

  @Roles(Role.SPECIALIST)
  @Get('specialist/my-children')
  @ApiOperation({ summary: 'Specialist Portal: Assigned Patients' })
  @ApiResponse({ status: 200, description: 'List of children assigned to specialist.' })
  specialistChildren(@CurrentUser() user: RequestUser) {
    return this.portals.specialistChildren(user.id);
  }

  @Roles(Role.SPECIALIST)
  @Get('specialist/my-sessions')
  @ApiOperation({ summary: 'Specialist Portal: Conducted Sessions' })
  @ApiResponse({ status: 200, description: 'History of treatment sessions.' })
  specialistSessions(@CurrentUser() user: RequestUser) {
    return this.portals.specialistSessions(user.id);
  }

  @Roles(Role.SPECIALIST)
  @Get('specialist/my-assessments')
  @ApiOperation({ summary: 'Specialist Portal: Authored Assessments' })
  @ApiResponse({ status: 200, description: 'Assessments created by specialist.' })
  specialistAssessments(@CurrentUser() user: RequestUser) {
    return this.portals.specialistAssessments(user.id);
  }

  @Roles(Role.SPECIALIST)
  @Get('specialist/my-progress')
  @ApiOperation({ summary: 'Specialist Portal: Recorded Milestones' })
  @ApiResponse({ status: 200, description: 'Progress entries recorded by specialist.' })
  specialistProgress(@CurrentUser() user: RequestUser) {
    return this.portals.specialistProgress(user.id);
  }

  @Roles(Role.SPECIALIST)
  @Get('specialist/my-goals')
  @ApiOperation({ summary: 'Specialist Portal: Managed Therapeutic Goals' })
  @ApiResponse({ status: 200, description: 'Goals managed by specialist.' })
  specialistGoals(@CurrentUser() user: RequestUser) {
    return this.portals.specialistGoals(user.id);
  }
}
