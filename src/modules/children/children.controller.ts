import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { ChildQueryDto, CreateChildDto, LinkParentDto, UpdateChildDto } from './dto/children.dto';
import { ChildrenService } from './children.service';

@ApiTags('children') @ApiBearerAuth() @Controller('children')
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post() create(@Body() dto: CreateChildDto, @CurrentUser() user: RequestUser) { return this.children.create(dto, user.id); }
  @Get() list(@Query() query: ChildQueryDto, @CurrentUser() user: RequestUser) { return this.children.list(query, user); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.children.get(id, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateChildDto, @CurrentUser() user: RequestUser) { return this.children.update(id, dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post(':id/archive') archive(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.children.archive(id, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post(':id/restore') restore(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.children.restore(id, user.id); }
  @Get(':id/parents') parents(@Param('id') id: string, @CurrentUser() user: RequestUser) { return this.children.parents(id, user); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Post(':childId/parents/:parentId') link(@Param('childId') childId: string, @Param('parentId') parentId: string, @Body() dto: LinkParentDto, @CurrentUser() user: RequestUser) { return this.children.linkParent(childId, parentId, dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Patch(':childId/parents/:parentId') updateLink(@Param('childId') childId: string, @Param('parentId') parentId: string, @Body() dto: LinkParentDto, @CurrentUser() user: RequestUser) { return this.children.updateLink(childId, parentId, dto, user.id); }
  @Roles(Role.SUPER_ADMIN, Role.ADMIN) @Delete(':childId/parents/:parentId') unlink(@Param('childId') childId: string, @Param('parentId') parentId: string, @CurrentUser() user: RequestUser) { return this.children.unlinkParent(childId, parentId, user.id); }
}
