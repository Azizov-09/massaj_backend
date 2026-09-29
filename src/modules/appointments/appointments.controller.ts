import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { AppointmentQueryDto, CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointments.dto';
import { AppointmentsService } from './appointments.service';
@ApiTags('appointments') @ApiBearerAuth() @Controller('appointments')
export class AppointmentsController { constructor(private readonly appointments: AppointmentsService) {}
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post() create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: RequestUser) { return this.appointments.create(dto, user.id); }
  @Get() list(@Query() query: AppointmentQueryDto, @CurrentUser() user: RequestUser) { return this.appointments.list(query, user); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.appointments.get(id, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto, @CurrentUser() user: RequestUser) { return this.appointments.update(id, dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post(':id/confirm') confirm(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.appointments.confirm(id, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post(':id/start') start(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.appointments.start(id, user); }
  @Post(':id/cancel') cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.appointments.cancel(id, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SPECIALIST) @Post(':id/no-show') noShow(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.appointments.noShow(id, user); }
}
