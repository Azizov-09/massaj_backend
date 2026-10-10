import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { UpdateNotificationPreferencesDto } from './dto/preferences.dto';
import { RealtimeGateway } from '../../infrastructure/realtime/realtime.gateway';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  relatedEntity?: string;
  relatedEntityId?: string;
  dedupeKey?: string;
  allowSms?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfiguration>,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  /**
   * Create a notification (and optional SMS delivery record).
   * Accepts an optional Prisma transaction client for atomic writes inside transactions.
   */
  async create(
    input: CreateNotificationInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    // Idempotency — skip if already created with same dedupeKey
    if (input.dedupeKey) {
      const existing = await tx.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true },
      });
      if (existing) return;
    }

    const notification = await tx.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        priority: input.priority ?? NotificationPriority.NORMAL,
        title: input.title,
        message: input.message,
        relatedEntity: input.relatedEntity,
        relatedEntityId: input.relatedEntityId,
        dedupeKey: input.dedupeKey,
      },
    });

    // Broadcast in real-time over WebSocket to user's personal room
    this.realtime?.emitToUser(input.userId, 'notification:new', notification);

    // Queue SMS delivery if allowed and preference permits
    if (input.allowSms && (await this.allowsSms(input.userId, input.type, tx))) {
      await tx.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          channel: NotificationChannel.SMS,
          provider: process.env.SMS_PROVIDER,
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'SEND_SMS_NOTIFICATION',
          aggregateType: 'Notification',
          aggregateId: notification.id,
          payload: { notificationId: notification.id },
        },
      });
    }
  }

  async listForUser(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        include: { deliveries: { select: { channel: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getOne(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      include: { deliveries: { select: { channel: true, status: true, sentAt: true } } },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const item = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: item.readAt ?? new Date() } });
  }

  async markAllRead(userId: string) {
    const now = new Date();
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
    return { success: true };
  }

  preferences(userId: string) {
    return this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }

  async deliveryAnalytics() {
    const byChannel = await this.prisma.notificationDelivery.groupBy({
      by: ['channel'],
      _count: { _all: true },
      orderBy: { channel: 'asc' },
    });
    const byStatus = await this.prisma.notificationDelivery.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    const [total, unread] = await this.prisma.$transaction([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { readAt: null } }),
    ]);
    const statusMap = new Map<NotificationDeliveryStatus, number>(byStatus.map((r) => [r.status, r._count._all]));
    const channelMap = new Map<NotificationChannel, number>(byChannel.map((r) => [r.channel, r._count._all]));
    const smsSent = statusMap.get(NotificationDeliveryStatus.SENT) ?? 0;
    const smsFailed = statusMap.get(NotificationDeliveryStatus.FAILED) ?? 0;
    const smsPending = statusMap.get(NotificationDeliveryStatus.PENDING) ?? 0;
    const smsQueued = channelMap.get(NotificationChannel.SMS) ?? 0;
    const deliveryTotal = smsQueued;
    return {
      totalNotifications: total,
      unreadNotifications: unread,
      smsQueued,
      smsSent,
      smsFailed,
      smsPending,
      deliveryRate: deliveryTotal > 0 ? ((smsSent / deliveryTotal) * 100).toFixed(1) : '0.0',
      failureRate: deliveryTotal > 0 ? ((smsFailed / deliveryTotal) * 100).toFixed(1) : '0.0',
      byChannel,
      byStatus,
    };
  }

  private async allowsSms(
    userId: string,
    type: NotificationType,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    if (!this.config.getOrThrow('sms.enabled', { infer: true })) return false;
    const preference = await tx.notificationPreference.findUnique({ where: { userId } });
    if (!preference) return false;
    const fields: Partial<Record<NotificationType, keyof typeof preference>> = {
      PAYMENT: 'paymentSms',
      DEBT: 'debtSms',
      ANNOUNCEMENT: 'announcementSms',
    };
    const field = fields[type];
    return field ? Boolean(preference[field]) : false;
  }
}
