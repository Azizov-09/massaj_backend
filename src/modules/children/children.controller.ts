import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { ChildQueryDto, CreateChildDto, LinkParentDto, UpdateChildDto } from './dto/children.dto';
import { ChildrenService } from './children.service';

@ApiTags('Children')
@ApiBearerAuth()
@Controller('children')
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Register New Child',
    description: 'Registers child entity in the center registry.',
  })
  @ApiResponse({ status: 201, description: 'Child profile registered.' })
  create(@Body() dto: CreateChildDto, @CurrentUser() user: RequestUser) {
    return this.children.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List Children',
    description: 'Lists children filtered by role access (Parent sees only their children; Specialists see assigned children; Admins see all).',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of children.' })
  list(@Query() query: ChildQueryDto, @CurrentUser() user: RequestUser) {
    return this.children.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Child Profile Details' })
  @ApiParam({ name: 'id', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'Child details.' })
  @ApiResponse({ status: 403, description: 'Forbidden (IDOR protection).' })
  @ApiResponse({ status: 404, description: 'Child not found.' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.children.get(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update Child Profile' })
  @ApiParam({ name: 'id', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'Child profile updated.' })
  update(@Param('id') id: string, @Body() dto: UpdateChildDto, @CurrentUser() user: RequestUser) {
    return this.children.update(id, dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive Child Profile' })
  @ApiParam({ name: 'id', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'Child profile archived.' })
  archive(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.children.archive(id, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore Archived Child Profile' })
  @ApiParam({ name: 'id', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'Child profile restored.' })
  restore(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.children.restore(id, user.id);
  }

  @Get(':id/parents')
  @ApiOperation({ summary: 'Get Linked Parents/Guardians' })
  @ApiParam({ name: 'id', description: 'Child UUID' })
  @ApiResponse({ status: 200, description: 'List of linked parents.' })
  parents(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.children.parents(id, user);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':childId/parents/:parentId')
  @ApiOperation({ summary: 'Link Parent to Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiParam({ name: 'parentId', description: 'Parent user UUID' })
  @ApiResponse({ status: 201, description: 'Parent linked successfully.' })
  link(
    @Param('childId') childId: string,
    @Param('parentId') parentId: string,
    @Body() dto: LinkParentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.children.linkParent(childId, parentId, dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Patch(':childId/parents/:parentId')
  @ApiOperation({ summary: 'Update Parent Relationship Link' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiParam({ name: 'parentId', description: 'Parent user UUID' })
  @ApiResponse({ status: 200, description: 'Link updated.' })
  updateLink(
    @Param('childId') childId: string,
    @Param('parentId') parentId: string,
    @Body() dto: LinkParentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.children.updateLink(childId, parentId, dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Delete(':childId/parents/:parentId')
  @ApiOperation({ summary: 'Unlink Parent From Child' })
  @ApiParam({ name: 'childId', description: 'Child UUID' })
  @ApiParam({ name: 'parentId', description: 'Parent user UUID' })
  @ApiResponse({ status: 200, description: 'Parent unlinked.' })
  unlink(
    @Param('childId') childId: string,
    @Param('parentId') parentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.children.unlinkParent(childId, parentId, user.id);
  }
}
