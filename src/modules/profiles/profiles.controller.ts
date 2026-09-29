import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateParentDto, CreateSpecialistDto, UpdateParentDto, UpdateSpecialistDto } from './dto/profiles.dto';
import { ProfilesService } from './profiles.service';

class PageQuery { page = 1; limit = 20; }
@ApiTags('profiles') @ApiBearerAuth() @Controller()
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post('parents') createParent(@Body() dto: CreateParentDto, @CurrentUser() user: RequestUser) { return this.profiles.createParent(dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Get('parents') parents(@Query() query: PageQuery) { return this.profiles.listParents(query.page, query.limit); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Get('parents/:id') parent(@Param('id') id: string) { return this.profiles.getParent(id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Patch('parents/:id') updateParent(@Param('id') id: string, @Body() dto: UpdateParentDto, @CurrentUser() user: RequestUser) { return this.profiles.updateParent(id, dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post('specialists') createSpecialist(@Body() dto: CreateSpecialistDto, @CurrentUser() user: RequestUser) { return this.profiles.createSpecialist(dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Get('specialists') specialists(@Query() query: PageQuery) { return this.profiles.listSpecialists(query.page, query.limit); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Get('specialists/:id') specialist(@Param('id') id: string) { return this.profiles.getSpecialist(id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Patch('specialists/:id') updateSpecialist(@Param('id') id: string, @Body() dto: UpdateSpecialistDto, @CurrentUser() user: RequestUser) { return this.profiles.updateSpecialist(id, dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post('specialists/:id/archive') archiveSpecialist(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.profiles.archiveSpecialist(id, user.id); }
  @Roles(Role.PARENT) @Get('parent/me') meParent(@CurrentUser() user: RequestUser) { return this.profiles.parentForUser(user.id); }
  @Roles(Role.SPECIALIST) @Get('specialist/me') meSpecialist(@CurrentUser() user: RequestUser) { return this.profiles.specialistForUser(user.id); }
}
