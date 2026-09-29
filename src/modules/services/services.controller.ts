import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateServiceDto, ServiceQueryDto, UpdateServiceDto } from './dto/service.dto';
import { ServicesService } from './services.service';
@ApiTags('services') @ApiBearerAuth() @Controller('services')
export class ServicesController { constructor(private readonly services: ServicesService) {}
  @Get() list(@Query() query: ServiceQueryDto) { return this.services.list(query.status); }
  @Get(':id') get(@Param('id') id: string) { return this.services.get(id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post() create(@Body() dto: CreateServiceDto, @CurrentUser() user: RequestUser) { return this.services.create(dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateServiceDto, @CurrentUser() user: RequestUser) { return this.services.update(id, dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post(':id/archive') archive(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.services.archive(id, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post(':id/restore') restore(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.services.restore(id, user.id); }
}
