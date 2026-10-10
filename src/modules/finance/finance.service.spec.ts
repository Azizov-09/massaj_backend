import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, TransactionDirection, TransactionType } from '@prisma/client';
import { FinanceService } from './finance.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('FinanceService Unit Tests', () => {
  let service: FinanceService;
  let mockPrisma: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      childParent: {
        findUnique: jest.fn(),
      },
      parent: {
        findUnique: jest.fn(),
      },
      child: {
        findUnique: jest.fn(),
      },
      activityLog: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
    };

    mockNotifications = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    service = new FinanceService(
      mockPrisma as unknown as PrismaService,
      mockNotifications as unknown as NotificationsService,
    );
  });

  describe('Payment Idempotency', () => {
    it('returns existing payment immediately without creating a new one if idempotencyKey exists', async () => {
      const existingPayment = {
        id: 'existing-pay-id',
        parentId: 'p1',
        childId: 'c1',
        amount: 200_000,
        idempotencyKey: 'idem-key-123',
      };

      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);

      const result = await service.recordPayment(
        {
          parentId: 'p1',
          childId: 'c1',
          amount: 200_000,
          method: PaymentMethod.CASH,
          idempotencyKey: 'idem-key-123',
        },
        'admin-user-id',
      );

      expect(result).toEqual(existingPayment);
      // Ensure no new payment or transaction created
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
    });

    it('creates Payment and atomic Transaction with idempotencyKey if new', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.childParent.findUnique.mockResolvedValue({
        id: 'cp-1',
        parent: { userId: 'parent-user-id' },
      });
      const newPayment = {
        id: 'new-pay-id',
        parentId: 'p1',
        childId: 'c1',
        amount: 500_000,
        method: PaymentMethod.TRANSFER,
        idempotencyKey: 'idem-key-new',
      };
      mockPrisma.payment.create.mockResolvedValue(newPayment);

      const result = await service.recordPayment(
        {
          parentId: 'p1',
          childId: 'c1',
          amount: 500_000,
          method: PaymentMethod.TRANSFER,
          idempotencyKey: 'idem-key-new',
        },
        'admin-user-id',
      );

      expect(result).toEqual(newPayment);
      expect(mockPrisma.payment.create).toHaveBeenCalled();
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentId: 'p1',
          childId: 'c1',
          type: TransactionType.PAYMENT,
          direction: TransactionDirection.IN,
          amount: 500_000,
          idempotencyKey: 'payment:idem-key-new',
        }),
      });
    });
  });

  describe('Refunds', () => {
    it('throws BadRequestException if refund exceeds original payment amount', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        parentId: 'p1',
        amount: 100_000,
        parent: { userId: 'parent-u1' },
      });
      // Already refunded 80k
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 80_000 },
      });

      // Requesting 30k refund (80k + 30k = 110k > 100k)
      await expect(
        service.refund('pay-1', { amount: 30_000, note: 'Too much' }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates compensating REFUND transaction when refund amount is valid', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        parentId: 'p1',
        childId: 'c1',
        amount: 100_000,
        parent: { userId: 'parent-u1' },
      });
      mockPrisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });
      const refundTx = {
        id: 'refund-tx-1',
        parentId: 'p1',
        type: TransactionType.REFUND,
        direction: TransactionDirection.OUT,
        amount: 50_000,
      };
      mockPrisma.transaction.create.mockResolvedValue(refundTx);

      const res = await service.refund('pay-1', { amount: 50_000, note: 'Partial refund' }, 'admin-id');
      expect(res).toEqual(refundTx);
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: TransactionType.REFUND,
          direction: TransactionDirection.OUT,
          amount: 50_000,
        }),
      });
    });
  });
});
