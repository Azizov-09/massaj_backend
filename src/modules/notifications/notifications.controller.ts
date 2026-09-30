import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiPropertyOptional, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationPreferencesDto } from './dto/preferences.dto';

class NotificationPageDto {
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

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'List User Notifications', description: 'Lists authenticated user in-app notifications with pagination.' })
  @ApiResponse({ status: 200, description: 'Paginated notifications list.' })
  list(@CurrentUser() user: RequestUser, @Query() query: NotificationPageDto) {
    return this.notifications.listForUser(user.id, query.page, query.limit);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Get Unread Notification Count' })
  @ApiResponse({ status: 200, description: 'Unread notification count.' })
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Get('notifications/:id')
  @ApiOperation({ summary: 'Get Single Notification Details' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification details.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  get(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.getOne(id, user.id);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark Notification As Read' })
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read.' })
  read(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notifications.markRead(id, user.id);
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Mark All Notifications As Read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read.' })
  readAll(@CurrentUser() user: RequestUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Get('notification-preferences')
  @ApiOperation({ summary: 'Get Current Notification Preferences' })
  @ApiResponse({ status: 200, description: 'User notification channel settings.' })
  preferences(@CurrentUser() user: RequestUser) {
    return this.notifications.preferences(user.id);
  }

  @Patch('notification-preferences')
  @ApiOperation({ summary: 'Update Current Notification Preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated.' })
  updatePreferences(@CurrentUser() user: RequestUser, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Get('notification-deliveries/analytics')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'System Notification Delivery Analytics (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'System-wide delivery statistics across SMS and Push.' })
  deliveryAnalytics() {
    return this.notifications.deliveryAnalytics();
  }
}
