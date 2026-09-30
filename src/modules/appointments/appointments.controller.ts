import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { AppointmentQueryDto, CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Schedule Appointment',
    description: 'Creates a new appointment with slot collision detection and status transition validation.',
  })
  @ApiResponse({ status: 201, description: 'Appointment created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid payload or end time before start time.' })
  @ApiResponse({ status: 409, description: 'Slot conflict: specialist or child already booked.' })
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: RequestUser) {
    return this.appointments.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List Appointments',
    description: 'Lists appointments filtered by role permissions, child, specialist, or status.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of appointments.' })
  list(@Query() query: AppointmentQueryDto, @CurrentUser() user: RequestUser) {
    return this.appointments.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Appointment Details' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment details.' })
  @ApiResponse({ status: 404, description: 'Appointment not found.' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.appointments.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update Appointment Details' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment updated successfully.' })
  @ApiResponse({ status: 404, description: 'Appointment not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @CurrentUser() user: RequestUser) {
    return this.appointments.update(id, dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm Appointment', description: 'Transitions appointment status to CONFIRMED.' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment confirmed.' })
  confirm(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.appointments.confirm(id, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post(':id/start')
  @ApiOperation({
    summary: 'Start Appointment & Open Rehabilitation Session',
    description: 'Transitions status to IN_PROGRESS and initializes clinical treatment session record.',
  })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment started and session created.' })
  start(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.appointments.start(id, user);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel Appointment',
    description: 'Cancels scheduled appointment (allowed by Admin or associated Parent).',
  })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment cancelled.' })
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.appointments.cancel(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @Post(':id/no-show')
  @ApiOperation({
    summary: 'Mark Appointment As No-Show',
    description: 'Marks appointment as NO_SHOW if the client failed to attend.',
  })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment marked as NO_SHOW.' })
  noShow(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.appointments.noShow(id, user);
  }
}
