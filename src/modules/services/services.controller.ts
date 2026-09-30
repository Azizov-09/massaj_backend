import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateServiceDto, ServiceQueryDto, UpdateServiceDto } from './dto/service.dto';
import { ServicesService } from './services.service';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List Clinical Services', description: 'Lists all services available in clinic catalog.' })
  @ApiResponse({ status: 200, description: 'List of services.' })
  list(@Query() query: ServiceQueryDto) {
    return this.services.list(query.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Service Details' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service details.' })
  @ApiResponse({ status: 404, description: 'Service not found.' })
  get(@Param('id') id: string) {
    return this.services.get(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create New Catalog Service' })
  @ApiResponse({ status: 201, description: 'Service created.' })
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: RequestUser) {
    return this.services.create(dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update Service Details / Pricing' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto, @CurrentUser() user: RequestUser) {
    return this.services.update(id, dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive Service' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service archived.' })
  archive(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.services.archive(id, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore Archived Service' })
  @ApiParam({ name: 'id', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service restored to active.' })
  restore(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.services.restore(id, user.id);
  }
}
