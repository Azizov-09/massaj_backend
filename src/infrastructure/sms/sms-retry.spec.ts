import { NotificationDeliveryStatus, OutboxStatus } from '@prisma/client';
import { OutboxProcessor } from '../outbox/outbox.processor';
import { PrismaService } from '../../database/prisma.service';
import { HttpSmsProvider } from './http-sms.provider';

describe('SMS Delivery & Outbox Retry Policy', () => {
  let processor: OutboxProcessor;
  let mockPrisma: any;
  let mockSms: any;

  beforeEach(() => {
    mockPrisma = {
      outboxEvent: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      notificationDelivery: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    mockSms = {
      send: jest.fn(),
    };

    processor = new OutboxProcessor(
      mockPrisma as unknown as PrismaService,
      mockSms as unknown as HttpSmsProvider,
    );
  });

  it('marks SMS delivery as SENT and outbox as PROCESSED on successful delivery', async () => {
    const event = {
      id: 'event-1',
      eventType: 'SEND_SMS_NOTIFICATION',
      status: OutboxStatus.PENDING,
      payload: { notificationId: 'notif-1' },
    };
    mockPrisma.outboxEvent.findUnique.mockResolvedValue(event);

    const delivery = {
      id: 'del-1',
      notificationId: 'notif-1',
      status: NotificationDeliveryStatus.PENDING,
      notification: {
        message: 'Reminder SMS message',
        user: { phone: '+998901234567' },
      },
    };
    mockPrisma.notificationDelivery.findFirst.mockResolvedValue(delivery);
    mockSms.send.mockResolvedValue({ providerMessageId: 'prov-msg-999' });

    const job: any = { data: { eventId: 'event-1' }, attemptsMade: 0 };
    await processor.process(job);

    // Delivery updated to PROCESSING first, then SENT
    expect(mockPrisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'del-1' },
      data: expect.objectContaining({
        status: NotificationDeliveryStatus.SENT,
        providerMessageId: 'prov-msg-999',
      }),
    });

    // Outbox event updated to PROCESSED
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: expect.objectContaining({
        status: OutboxStatus.PROCESSED,
      }),
    });
  });

  it('handles temporary failure with retry when attemptsMade < 2', async () => {
    const event = {
      id: 'event-2',
      eventType: 'SEND_SMS_NOTIFICATION',
      status: OutboxStatus.PENDING,
      payload: { notificationId: 'notif-2' },
    };
    mockPrisma.outboxEvent.findUnique.mockResolvedValue(event);

    const delivery = {
      id: 'del-2',
      notificationId: 'notif-2',
      status: NotificationDeliveryStatus.PENDING,
      notification: {
        message: 'Payment received SMS',
        user: { phone: '+998901234567' },
      },
    };
    mockPrisma.notificationDelivery.findFirst.mockResolvedValue(delivery);
    mockSms.send.mockRejectedValue(new Error('Network timeout'));

    const job: any = { data: { eventId: 'event-2' }, attemptsMade: 1 };

    await expect(processor.process(job)).rejects.toThrow('Network timeout');

    // Outbox event status remains PENDING for next attempt with backoff
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-2' },
      data: expect.objectContaining({
        status: OutboxStatus.PENDING,
        lastError: 'Network timeout',
      }),
    });
  });

  it('marks outbox event as FAILED after max retry threshold (attemptsMade >= 2)', async () => {
    const event = {
      id: 'event-3',
      eventType: 'SEND_SMS_NOTIFICATION',
      status: OutboxStatus.PENDING,
      payload: { notificationId: 'notif-3' },
    };
    mockPrisma.outboxEvent.findUnique.mockResolvedValue(event);

    const delivery = {
      id: 'del-3',
      notificationId: 'notif-3',
      status: NotificationDeliveryStatus.PENDING,
      notification: {
        message: 'Debt alert SMS',
        user: { phone: '+998901234567' },
      },
    };
    mockPrisma.notificationDelivery.findFirst.mockResolvedValue(delivery);
    mockSms.send.mockRejectedValue(new Error('Provider 500 error'));

    const job: any = { data: { eventId: 'event-3' }, attemptsMade: 2 };

    await expect(processor.process(job)).rejects.toThrow('Provider 500 error');

    // Marked as FAILED permanently so worker stops retrying endlessly
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-3' },
      data: expect.objectContaining({
        status: OutboxStatus.FAILED,
        lastError: 'Provider 500 error',
      }),
    });
  });
});
