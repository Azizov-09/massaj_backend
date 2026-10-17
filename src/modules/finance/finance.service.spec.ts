import { BadRequestException, ConflictException } from '@nestjs/common';
import { PaymentMethod, TransactionDirection, TransactionType } from '@prisma/client';
import { validate } from 'class-validator';
import { FinanceService } from './finance.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecordPaymentDto } from './dto/finance.dto';

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
        findFirst: jest.fn(),
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
      emitRealtimeNotification: jest.fn(),
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
        method: PaymentMethod.CASH,
        idempotencyKey: 'idem-key-123',
      };

      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);
      mockPrisma.parent.findFirst.mockResolvedValue({ id: 'p1', userId: 'parent-user-id' });

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
      mockPrisma.parent.findFirst.mockResolvedValue({ id: 'p1', userId: 'parent-user-id' });
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

    it('rejects an invalid parent-child relation before writing payment, ledger, or notification', async () => {
      mockPrisma.parent.findFirst.mockResolvedValue({ id: 'p1', userId: 'parent-user-id' });
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.childParent.findUnique.mockResolvedValue(null);

      await expect(service.recordPayment({
        parentId: 'p1',
        childId: 'unrelated-child',
        amount: 150_000,
        method: PaymentMethod.CASH,
        idempotencyKey: 'invalid-relation-key',
      }, 'admin-user-id')).rejects.toThrow(BadRequestException);

      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
      expect(mockNotifications.create).not.toHaveBeenCalled();
    });

    it('does not create a success notification when the ledger write fails', async () => {
      mockPrisma.parent.findFirst.mockResolvedValue({ id: 'p1', userId: 'parent-user-id' });
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.childParent.findUnique.mockResolvedValue({
        id: 'cp-1',
        parent: { userId: 'parent-user-id' },
      });
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment-1' });
      mockPrisma.transaction.create.mockRejectedValue(new Error('ledger unavailable'));

      await expect(service.recordPayment({
        parentId: 'p1',
        childId: 'c1',
        amount: 150_000,
        method: PaymentMethod.CASH,
        idempotencyKey: 'ledger-failure-key',
      }, 'admin-user-id')).rejects.toThrow('ledger unavailable');

      expect(mockNotifications.create).not.toHaveBeenCalled();
      expect(mockNotifications.emitRealtimeNotification).not.toHaveBeenCalled();
    });

    it('retries a serializable conflict and succeeds without duplicate writes', async () => {
      let attempts = 0;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        attempts += 1;
        if (attempts < 3) throw Object.assign(new Error('serialization conflict'), { code: 'P2034' });
        return cb(mockPrisma);
      });
      mockPrisma.parent.findFirst.mockResolvedValue({ id: 'p1', userId: 'parent-user-id' });
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      mockPrisma.childParent.findUnique.mockResolvedValue({
        id: 'cp-1',
        parent: { userId: 'parent-user-id' },
      });
      mockPrisma.payment.create.mockResolvedValue({
        id: 'payment-retry',
        parentId: 'p1',
        childId: 'c1',
        amount: 150_000,
        method: PaymentMethod.CASH,
      });

      await expect(service.recordPayment({
        parentId: 'p1',
        childId: 'c1',
        amount: 150_000,
        method: PaymentMethod.CASH,
        idempotencyKey: 'retry-payment-key',
      }, 'admin-user-id')).resolves.toEqual(expect.objectContaining({ id: 'payment-retry' }));

      expect(attempts).toBe(3);
      expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Refunds', () => {
    it('rejects reuse of a refund idempotency key with a different amount', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'refund-existing',
        amount: 10_000,
        description: 'Refund for payment pay-1: Original request',
      });

      await expect(service.refund('pay-1', {
        amount: 20_000,
        note: 'Changed request',
        idempotencyKey: 'refund-reused-key',
      }, 'admin-id')).rejects.toThrow(ConflictException);

      expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
      expect(mockNotifications.create).not.toHaveBeenCalled();
    });

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
        service.refund('pay-1', { amount: 30_000, note: 'Too much', idempotencyKey: 'refund-key-1' }, 'admin-id'),
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

      const res = await service.refund('pay-1', { amount: 50_000, note: 'Partial refund', idempotencyKey: 'refund-key-2' }, 'admin-id');
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
        {
          id: 'p-1',
          user: { fullName: 'Ali Valiyev', phone: '+998901234567' },
          children: [{ child: { id: 'c-1', firstName: 'Umar', lastName: 'Valiyev' } }],
        },
      ]);

      const debtors = await service.allDebtors();
      expect(mockPrisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['parentId', 'childId', 'direction'],
          _sum: { amount: true },
        }),
      );
      expect(debtors).toHaveLength(1);
      expect(debtors[0]).toEqual(expect.objectContaining({
        parentId: 'p-1', debt: 150_000,
        children: [expect.objectContaining({ id: 'c-1', fullName: 'Umar Valiyev' })],
      }));
    });
  });

  describe('Payment relation presentation', () => {
    it('returns explicit payer and child identities for payment details', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'payment-1',
        parent: { id: 'parent-1', user: { fullName: 'Ali Valiyev', phone: '+998901234567' } },
        child: { id: 'child-1', firstName: 'Umar', lastName: 'Valiyev' },
      });

      await expect(service.paymentById('payment-1')).resolves.toEqual(expect.objectContaining({
        payer: { id: 'parent-1', fullName: 'Ali Valiyev', phone: '+998901234567' },
        child: expect.objectContaining({ id: 'child-1', fullName: 'Umar Valiyev' }),
      }));
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

describe('RecordPaymentDto validation', () => {
  const valid = {
    parentId: 'a8098c1a-f86e-11da-bd1a-00112444be1e',
    childId: 'b8098c1a-f86e-11da-bd1a-00112444be1e',
    amount: 150_000,
    method: PaymentMethod.CASH,
    idempotencyKey: 'payment-request-1',
  };

  it('accepts a valid whole-UZS payment including the documented maximum', async () => {
    const dto = Object.assign(new RecordPaymentDto(), valid, { amount: 2_000_000_000 });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    ['parentId', { parentId: 'not-a-uuid' }],
    ['childId', { childId: 'not-a-uuid' }],
    ['amount', { amount: 0 }],
    ['amount', { amount: -1 }],
    ['amount', { amount: 2_000_000_001 }],
    ['method', { method: 'BITCOIN' }],
    ['idempotencyKey', { idempotencyKey: 'short' }],
  ])('rejects an invalid %s', async (property, override) => {
    const dto = Object.assign(new RecordPaymentDto(), valid, override);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === property)).toBe(true);
  });
});
