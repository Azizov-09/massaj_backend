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
          paymentId: 'new-pay-id',
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
        paymentId: 'pay-1',
        type: TransactionType.REFUND,
        direction: TransactionDirection.OUT,
        amount: 50_000,
      };
      mockPrisma.transaction.create.mockResolvedValue(refundTx);

      const res = await service.refund('pay-1', { amount: 50_000, note: 'Partial refund' }, 'admin-id');
      expect(res).toEqual(refundTx);
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: 'pay-1',
          type: TransactionType.REFUND,
          direction: TransactionDirection.OUT,
          amount: 50_000,
        }),
      });
    });
  });

  describe('allDebtors (PostgreSQL Database Aggregation)', () => {
    it('computes debtors using database groupBy aggregation', async () => {
      mockPrisma.transaction.groupBy = jest.fn().mockResolvedValue([
        { parentId: 'p-1', direction: TransactionDirection.IN, _sum: { amount: 100_000 } },
        { parentId: 'p-1', direction: TransactionDirection.OUT, _sum: { amount: 250_000 } },
        { parentId: 'p-2', direction: TransactionDirection.IN, _sum: { amount: 500_000 } },
        { parentId: 'p-2', direction: TransactionDirection.OUT, _sum: { amount: 100_000 } },
      ]);
      mockPrisma.parent.findMany = jest.fn().mockResolvedValue([
        { id: 'p-1', user: { fullName: 'Ali Valiyev', phone: '+998901234567' } },
      ]);

      const debtors = await service.allDebtors();
      expect(mockPrisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['parentId', 'direction'],
          _sum: { amount: true },
        }),
      );
      expect(debtors).toHaveLength(1);
      expect(debtors[0]).toEqual({
        parentId: 'p-1',
        debt: 150_000,
        parent: { id: 'p-1', user: { fullName: 'Ali Valiyev', phone: '+998901234567' } },
      });
    });
  });

  describe('Date Range Filtering for Payments and Transactions', () => {
    it('applies date range bounds on payments query', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      await service.payments('p-1', 'c-1', 1, 20, '2026-10-01', '2026-10-10');

      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: 'p-1',
            childId: 'c-1',
            paidAt: expect.objectContaining({
              gte: new Date('2026-10-01'),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('applies date range bounds on transactions query', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);
      mockPrisma.transaction.count.mockResolvedValue(0);

      await service.transactions('p-1', 'c-1', 1, 20, '2026-10-01', '2026-10-10');

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: 'p-1',
            childId: 'c-1',
            createdAt: expect.objectContaining({
              gte: new Date('2026-10-01'),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
