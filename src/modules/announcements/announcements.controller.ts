import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateAnnouncementDto, PublishAnnouncementDto } from './dto/announcements.dto';
import { AnnouncementsService } from './announcements.service';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Draft Announcement' })
  @ApiResponse({ status: 201, description: 'Announcement created.' })
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: RequestUser) {
    return this.announcements.create(dto, user.id);
  }

  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish & Broadcast Announcement' })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement published and queued for delivery.' })
  publish(@Param('id') id: string, @Body() dto: PublishAnnouncementDto, @CurrentUser() user: RequestUser) {
    return this.announcements.publish(id, user.id, dto.recipientUserIds);
  }

  @Roles(Role.PARENT)
  @Get('my')
  @ApiOperation({ summary: 'List Announcements For Current Parent' })
  @ApiResponse({ status: 200, description: 'List of announcements.' })
  mine(@CurrentUser() user: RequestUser) {
    return this.announcements.listForParent(user.id);
  }

  @Roles(Role.PARENT)
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark Announcement As Read' })
  @ApiParam({ name: 'id', description: 'Announcement UUID' })
  @ApiResponse({ status: 200, description: 'Announcement marked as read.' })
  read(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.announcements.markRead(id, user.id);
  }
}
