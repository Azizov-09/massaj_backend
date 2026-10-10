import { NotificationChannel, NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('NotificationsService (Preferences & Deduplication)', () => {
  let service: NotificationsService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
      notification: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      notificationDelivery: {
        create: jest.fn(),
        findFirst: jest.fn(),
        groupBy: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
    };

    mockConfig = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'sms.enabled') return true;
        return null;
      }),
    };

    service = new NotificationsService(
      mockPrisma as unknown as PrismaService,
      mockConfig as unknown as ConfigService<any>,
    );
  });

  describe('Deduplication', () => {
    it('skips notification creation if dedupeKey already exists', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({ id: 'existing-notif-id' });

      await service.create({
        userId: 'user-1',
        type: NotificationType.PAYMENT,
        title: 'Payment Receipt',
        message: 'Receipt text',
        dedupeKey: 'payment:receipt-1',
      });

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { dedupeKey: 'payment:receipt-1' },
        select: { id: true },
      });
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(mockPrisma.notificationDelivery.create).not.toHaveBeenCalled();
    });

    it('creates notification and evaluates delivery when dedupeKey is new', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      mockPrisma.notification.create.mockResolvedValue({
        id: 'new-notif-id',
        userId: 'user-1',
        type: NotificationType.PAYMENT,
      });
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        paymentSms: true,
      });

      await service.create({
        userId: 'user-1',
        type: NotificationType.PAYMENT,
        title: 'Payment Received',
        message: 'You have a new payment',
        dedupeKey: 'payment:pay-1',
        allowSms: true,
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.PAYMENT,
          dedupeKey: 'payment:pay-1',
        }),
      });
      expect(mockPrisma.notificationDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notificationId: 'new-notif-id',
          channel: NotificationChannel.SMS,
        }),
      });
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'SEND_SMS_NOTIFICATION',
          aggregateType: 'Notification',
          aggregateId: 'new-notif-id',
        }),
      });
    });
  });

  describe('Notification Preferences Evaluation', () => {
    it('does not queue SMS if user disabled SMS for this notification type', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-2',
        userId: 'user-1',
        type: NotificationType.PAYMENT,
      });
      // User disabled paymentSms
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        paymentSms: false,
      });

      await service.create({
        userId: 'user-1',
        type: NotificationType.PAYMENT,
        title: 'Payment Received',
        message: 'Paid 100k',
        allowSms: true,
      });

      expect(mockPrisma.notificationDelivery.create).not.toHaveBeenCalled();
      expect(mockPrisma.outboxEvent.create).not.toHaveBeenCalled();
    });

    it('does not queue SMS if SMS_ENABLED is false globally', async () => {
      mockConfig.getOrThrow.mockReturnValue(false); // SMS disabled globally
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-3',
        userId: 'user-1',
        type: NotificationType.DEBT,
      });

      await service.create({
        userId: 'user-1',
        type: NotificationType.DEBT,
        title: 'Debt Created',
        message: 'Debt 50k',
        allowSms: true,
      });

      expect(mockPrisma.notificationDelivery.create).not.toHaveBeenCalled();
    });

    it('does not queue SMS if allowSms is false (e.g. routine clinical notes)', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-4',
        userId: 'user-1',
        type: NotificationType.ASSESSMENT,
      });

      await service.create({
        userId: 'user-1',
        type: NotificationType.ASSESSMENT,
        title: 'Assessment Recorded',
        message: 'Assessment summary',
        allowSms: false,
      });

      expect(mockPrisma.notificationDelivery.create).not.toHaveBeenCalled();
    });
  });
});
