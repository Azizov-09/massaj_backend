import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { AdminsService } from './admins.service';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';

class AdminListQuery {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ enum: Role, description: 'Filter by role' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search by name or phone' })
  @IsOptional()
  @IsString()
  search?: string;
}

@ApiTags('Admins')
@ApiBearerAuth('bearer')
@Roles(Role.SUPER_ADMIN)
@Controller('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create Administrator',
    description: 'Creates a new SUPER_ADMIN or ADMIN account. Only SUPER_ADMIN can perform this.',
  })
  @ApiResponse({ status: 201, description: 'Administrator account created successfully.' })
  @ApiResponse({ status: 409, description: 'Phone number already registered.' })
  create(@Body() dto: CreateAdminDto, @CurrentUser() user: RequestUser) {
    return this.admins.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List Administrators',
    description: 'Returns paginated list of administrators with optional filters.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of admins.' })
  findAll(@Query() query: AdminListQuery) {
    return this.admins.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Administrator By ID' })
  @ApiParam({ name: 'id', description: 'Admin User UUID' })
  @ApiResponse({ status: 200, description: 'Admin details.' })
  @ApiResponse({ status: 404, description: 'Admin not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.admins.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Administrator Profile' })
  @ApiParam({ name: 'id', description: 'Admin User UUID' })
  @ApiResponse({ status: 200, description: 'Admin profile updated.' })
  @ApiResponse({ status: 404, description: 'Admin not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.admins.update(id, dto, user.id);
  }

  @Post(':id/archive')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Archive Administrator',
    description: 'Blocks the admin account and revokes system access. Cannot archive yourself.',
  })
  @ApiParam({ name: 'id', description: 'Admin User UUID' })
  @ApiResponse({ status: 200, description: 'Admin archived successfully.' })
  @ApiResponse({ status: 403, description: 'Cannot archive your own account.' })
  @ApiResponse({ status: 404, description: 'Admin not found.' })
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.admins.archive(id, user.id);
  }
}
