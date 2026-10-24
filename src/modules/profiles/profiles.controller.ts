import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role, SpecialistStatus, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import {
  CreateParentDto,
  CreateSpecialistDto,
  UpdateParentDto,
  UpdateParentStatusDto,
  UpdateSpecialistDto,
  UpdateSpecialistStatusDto,
} from './dto/profiles.dto';
import { ProfilesService } from './profiles.service';

class PageQuery {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 20;
}

@ApiTags('Profiles')
@ApiBearerAuth()
@Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('parents')
  @ApiOperation({ summary: 'Create Parent Profile & User Account' })
  @ApiResponse({ status: 201, description: 'Parent account created.' })
  createParent(@Body() dto: CreateParentDto, @CurrentUser() user: RequestUser) {
    return this.profiles.createParent(dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('parents')
  @ApiOperation({ summary: 'List Parent Accounts (Paginated)' })
  @ApiResponse({ status: 200, description: 'List of parents.' })
  parents(@Query() query: PageQuery) {
    return this.profiles.listParents(query.page, query.limit);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('parents/:id')
  @ApiOperation({ summary: 'Get Parent Account By ID' })
  @ApiParam({ name: 'id', description: 'Parent UUID' })
  @ApiResponse({ status: 200, description: 'Parent details.' })
  parent(@Param('id') id: string) {
    return this.profiles.getParent(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('parents/:id')
  @ApiOperation({ summary: 'Update Parent Profile' })
  @ApiParam({ name: 'id', description: 'Parent UUID' })
  @ApiResponse({ status: 200, description: 'Parent updated.' })
  updateParent(@Param('id') id: string, @Body() dto: UpdateParentDto, @CurrentUser() user: RequestUser) {
    return this.profiles.updateParent(id, dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('parents/:id/status')
  @ApiOperation({ summary: 'Activate or deactivate Parent Account' })
  @ApiResponse({ status: 200, description: 'Parent status updated and active sessions revoked.' })
  updateParentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParentStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    const status = dto.status === 'ACTIVE' ? UserStatus.ACTIVE : UserStatus.INACTIVE;
    return this.profiles.updateParentStatus(id, status, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('parents/:id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive Parent Account (soft delete)' })
  archiveParent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.profiles.archiveParent(id, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete('parents/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Archive Parent Account (DELETE compatibility route)',
    description: 'Soft archive only. No Parent, ChildParent, payment, ledger, or clinical row is deleted.',
  })
  removeParent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.profiles.archiveParent(id, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('parents/:id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore Archived Parent Account' })
  restoreParent(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.profiles.restoreParent(id, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('specialists')
  @ApiOperation({ summary: 'Create Specialist Profile & User Account' })
  @ApiResponse({ status: 201, description: 'Specialist account created.' })
  createSpecialist(@Body() dto: CreateSpecialistDto, @CurrentUser() user: RequestUser) {
    return this.profiles.createSpecialist(dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('specialists')
  @ApiOperation({ summary: 'List Specialist Profiles (Paginated)' })
  @ApiResponse({ status: 200, description: 'List of specialists.' })
  specialists(@Query() query: PageQuery) {
    return this.profiles.listSpecialists(query.page, query.limit);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Get('specialists/:id')
  @ApiOperation({ summary: 'Get Specialist Details By ID' })
  @ApiParam({ name: 'id', description: 'Specialist UUID' })
  @ApiResponse({ status: 200, description: 'Specialist details.' })
  specialist(@Param('id') id: string) {
    return this.profiles.getSpecialist(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('specialists/:id')
  @ApiOperation({ summary: 'Update Specialist Details' })
  @ApiParam({ name: 'id', description: 'Specialist UUID' })
  @ApiResponse({ status: 200, description: 'Specialist updated.' })
  updateSpecialist(@Param('id') id: string, @Body() dto: UpdateSpecialistDto, @CurrentUser() user: RequestUser) {
    return this.profiles.updateSpecialist(id, dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch('specialists/:id/status')
  @ApiOperation({ summary: 'Activate or deactivate Specialist Account' })
  @ApiResponse({ status: 200, description: 'Specialist status updated and active sessions revoked.' })
  updateSpecialistStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialistStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    const status = dto.status === SpecialistStatus.ACTIVE
      ? SpecialistStatus.ACTIVE
      : SpecialistStatus.INACTIVE;
    return this.profiles.updateSpecialistStatus(id, status, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('specialists/:id/archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archive Specialist Profile' })
  @ApiParam({ name: 'id', description: 'Specialist UUID' })
  @ApiResponse({ status: 200, description: 'Specialist archived.' })
  archiveSpecialist(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.profiles.archiveSpecialist(id, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post('specialists/:id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore Archived Specialist Profile' })
  restoreSpecialist(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.profiles.restoreSpecialist(id, user.id);
  }

  @Roles(Role.PARENT)
  @Get('parent/me')
  @ApiOperation({ summary: 'Get Current Authenticated Parent Profile' })
  @ApiResponse({ status: 200, description: 'Current parent profile.' })
  meParent(@CurrentUser() user: RequestUser) {
    return this.profiles.parentForUser(user.id);
  }

  @Roles(Role.SPECIALIST)
  @Get('specialist/me')
  @ApiOperation({ summary: 'Get Current Authenticated Specialist Profile' })
  @ApiResponse({ status: 200, description: 'Current specialist profile.' })
  meSpecialist(@CurrentUser() user: RequestUser) {
    return this.profiles.specialistForUser(user.id);
  }
}
