import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentQueryDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
} from './dto/appointments.dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Schedule an appointment' })
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: RequestUser) {
    return this.appointments.create(dto, user);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST, Role.PARENT)
  @ApiOperation({ summary: 'List appointments visible to the current role' })
  list(@Query() query: AppointmentQueryDto, @CurrentUser() user: RequestUser) {
    return this.appointments.list(query, user);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST, Role.PARENT)
  @ApiOperation({ summary: 'Get appointment details' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.appointments.get(id, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Reschedule or edit a pending appointment' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.appointments.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST)
  @ApiOperation({ summary: 'Confirm, start, or cancel an appointment' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.appointments.updateStatus(id, dto.status, user);
  }
}
