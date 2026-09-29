import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationPreferencesDto } from './dto/preferences.dto';

class NotificationPageDto {
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) @Max(100) limit = 20;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'List current user notifications (paginated)' })
  list(@CurrentUser() user: RequestUser, @Query() query: NotificationPageDto) {
    return this.notifications.listForUser(user.id, query.page, query.limit);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Get('notifications/:id')
  @ApiOperation({ summary: 'Get single notification' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.getOne(id, user.id);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  read(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(id, user.id);
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  readAll(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Get('notification-preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  preferences(@CurrentUser() user: RequestUser) {
    return this.notifications.preferences(user.id);
  }

  @Patch('notification-preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  updatePreferences(@CurrentUser() user: RequestUser, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.notifications.updatePreferences(user.id, dto);
  }

  // SUPER_ADMIN only — delivery analytics
  @Get('notification-deliveries/analytics')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Notification delivery analytics (SUPER_ADMIN only)' })
  deliveryAnalytics() {
    return this.notifications.deliveryAnalytics();
  }
}
