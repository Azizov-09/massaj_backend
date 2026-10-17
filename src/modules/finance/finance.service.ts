import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, Role, TransactionDirection, TransactionType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { calculateFinancialState } from '../../common/utils/money.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RecordChargeDto, RecordPaymentDto, RefundDto } from './dto/finance.dto';
import { RequestUser } from '../../common/types/request-user.type';


function buildDateRange(from?: string, to?: string) {
  const result: { gte?: Date; lte?: Date } = {};
  if (from) result.gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    if (!to.includes('T')) {
      toDate.setUTCHours(23, 59, 59, 999);
    }
    result.lte = toDate;
  }
  return Object.keys(result).length ? result : undefined;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async recordPayment(dto: RecordPaymentDto, actorId: string) {
    try {
      const result = await this.runSerializable(async (tx) => {
        const parent = await tx.parent.findFirst({
          where: { OR: [{ id: dto.parentId }, { userId: dto.parentId }] },
          select: { id: true, userId: true },
        });
        if (!parent) throw new NotFoundException('Parent not found');

        // Idempotency check
        const duplicate = await tx.payment.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
        if (duplicate) {
          if (
            duplicate.parentId !== parent.id ||
            duplicate.childId !== dto.childId ||
            duplicate.amount !== dto.amount ||
            duplicate.method !== dto.method ||
            (duplicate.note ?? null) !== (dto.note ?? null) ||
            (dto.paidAt !== undefined && duplicate.paidAt.getTime() !== new Date(dto.paidAt).getTime())
          ) {
            throw new ConflictException('Idempotency key was already used for a different payment');
          }
          return { payment: duplicate, notif: null, parentUserId: null };
        }
        // Verify parent-child relationship
        const relation = await tx.childParent.findUnique({
          where: { childId_parentId: { childId: dto.childId, parentId: parent.id } },
          include: { parent: { select: { userId: true } } },
        });
        if (!relation) throw new BadRequestException('Parent must be related to the child');

        const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
        if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Invalid payment date');
        if (paidAt.getTime() > Date.now()) throw new BadRequestException('Payment date cannot be in the future');

        const payment = await tx.payment.create({
          data: {
            parentId: parent.id,
            childId: dto.childId,
            amount: dto.amount,
            method: dto.method,
            note: dto.note,
            paidAt,
            idempotencyKey: dto.idempotencyKey,
          },
        });

        await tx.transaction.create({
          data: {
            parentId: parent.id,
            childId: dto.childId,
            paymentId: payment.id,
            type: TransactionType.PAYMENT,
            direction: TransactionDirection.IN,
            amount: dto.amount,
            description: `Manual ${dto.method.toLowerCase()} payment`,
            idempotencyKey: `payment:${dto.idempotencyKey}`,
          },
        });

        const notif = await this.notifications.create(
          {
            userId: relation.parent.userId,
            type: NotificationType.PAYMENT,
            title: 'Payment received',
            message: `A payment of ${dto.amount.toLocaleString()} UZS was recorded.`,
            relatedEntity: 'Payment',
            relatedEntityId: payment.id,
            dedupeKey: `payment-received:${payment.id}`,
            allowSms: false,
          },
          tx,
        );

        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'PAYMENT_RECORDED',
            entity: 'Payment',
            entityId: payment.id,
            description: `Recorded manual payment of ${dto.amount} UZS`,
          },
        });

        return { payment, notif, parentUserId: relation.parent.userId };
      });

      // Post-commit side-effect: Broadcast realtime event only after successful commit!
      if (result.notif && result.parentUserId) {
        this.notifications.emitRealtimeNotification(result.parentUserId, result.notif);
      }
      return result.payment;
    } catch (error) {
      if (this.isUnique(error)) {
        const duplicate = await this.prisma.payment.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
        const parent = await this.prisma.parent.findFirst({
          where: { OR: [{ id: dto.parentId }, { userId: dto.parentId }] },
          select: { id: true },
        });
        if (
          duplicate &&
          parent &&
          duplicate.parentId === parent.id &&
          duplicate.childId === dto.childId &&
          duplicate.amount === dto.amount &&
          duplicate.method === dto.method &&
          (duplicate.note ?? null) === (dto.note ?? null) &&
          (dto.paidAt === undefined || duplicate.paidAt.getTime() === new Date(dto.paidAt).getTime())
        ) {
          return duplicate;
        }
        throw new ConflictException('Duplicate payment request');
      }
      throw error;
    }
  }

  async refund(paymentId: string, dto: RefundDto, actorId: string) {
    try {
      const result = await this.runSerializable(async (tx) => {
        const requestKey = `refund:${paymentId}:${dto.idempotencyKey}`;
        const duplicate = await tx.transaction.findUnique({ where: { idempotencyKey: requestKey } });
        if (duplicate) {
          const expectedDescription = `Refund for payment ${paymentId}${dto.note ? `: ${dto.note}` : ''}`;
          if (duplicate.amount !== dto.amount || duplicate.description !== expectedDescription) {
            throw new ConflictException('Idempotency key was already used for a different refund');
          }
          return { refund: duplicate, notif: null, parentUserId: null };
        }

        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { parent: { select: { userId: true } } },
        });
        if (!payment) throw new NotFoundException('Payment not found');

        // Check cumulative refunds don't exceed original amount (linked by paymentId with fallback)
        const aggregate = await tx.transaction.aggregate({
          where: {
            type: TransactionType.REFUND,
            OR: [
              { paymentId: payment.id },
              { description: { startsWith: `Refund for payment ${payment.id}` } },
            ],
          },
          _sum: { amount: true },
        });
        const alreadyRefunded = aggregate._sum.amount ?? 0;
        if (dto.amount + alreadyRefunded > payment.amount) {
          throw new BadRequestException('Refund exceeds original payment amount');
        }

        const refund = await tx.transaction.create({
          data: {
            parentId: payment.parentId,
            childId: payment.childId,
            paymentId: payment.id,
            type: TransactionType.REFUND,
            direction: TransactionDirection.OUT,
            amount: dto.amount,
            description: `Refund for payment ${payment.id}${dto.note ? `: ${dto.note}` : ''}`,
            idempotencyKey: requestKey,
          },
        });

        const notif = await this.notifications.create(
          {
            userId: payment.parent.userId,
            type: NotificationType.PAYMENT,
            title: 'Payment refund recorded',
            message: `A refund of ${dto.amount.toLocaleString()} UZS was recorded.`,
            relatedEntity: 'Transaction',
            relatedEntityId: refund.id,
            dedupeKey: `refund:${refund.id}`,
            allowSms: false,
          },
          tx,
        );

        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'PAYMENT_REFUNDED',
            entity: 'Transaction',
            entityId: refund.id,
            description: `Refunded ${dto.amount} UZS`,
          },
        });

        return { refund, notif, parentUserId: payment.parent.userId };
      });

      // Post-commit side-effect: Broadcast realtime event only after successful commit!
      if (result.notif && result.parentUserId) {
        this.notifications.emitRealtimeNotification(result.parentUserId, result.notif);
      }
      return result.refund;
    } catch (error) {
      if (this.isUnique(error)) {
        const requestKey = `refund:${paymentId}:${dto.idempotencyKey}`;
        const duplicate = await this.prisma.transaction.findUnique({ where: { idempotencyKey: requestKey } });
        const expectedDescription = `Refund for payment ${paymentId}${dto.note ? `: ${dto.note}` : ''}`;
        if (
          duplicate &&
          duplicate.amount === dto.amount &&
          duplicate.description === expectedDescription
        ) {
          return duplicate;
        }
        throw new ConflictException('Duplicate refund request');
      }
      throw error;
    }
  }

  async recordCharge(dto: RecordChargeDto, actorId: string) {
    try {
      const result = await this.runSerializable(async (tx) => {
      const requestKey = `charge:${dto.idempotencyKey}`;
      const parent = await tx.parent.findFirst({
        where: { OR: [{ id: dto.parentId }, { userId: dto.parentId }] },
        include: { user: { select: { id: true, fullName: true } } },
      });
      if (!parent) throw new NotFoundException('Parent not found');

      const duplicate = await tx.transaction.findUnique({ where: { idempotencyKey: requestKey } });
      if (duplicate) {
        if (
          duplicate.parentId !== parent.id ||
          duplicate.childId !== (dto.childId ?? null) ||
          duplicate.amount !== dto.amount ||
          duplicate.description !== dto.description
        ) {
          throw new ConflictException('Idempotency key was already used for a different charge');
        }
        const rows = await tx.transaction.findMany({
          where: { parentId: duplicate.parentId },
          select: { amount: true, direction: true, type: true, parentId: true },
        });
        return {
          chargeTx: duplicate,
          notif: null,
          parentUserId: null,
          finState: calculateFinancialState(rows, duplicate.parentId ?? ''),
        };
      }

      if (dto.childId) {
        const relation = await tx.childParent.findUnique({
          where: { childId_parentId: { childId: dto.childId, parentId: parent.id } },
        });
        if (!relation) throw new BadRequestException('Child is not related to parent');
      }

      // Record charge transaction
      const chargeTx = await tx.transaction.create({
        data: {
          parentId: parent.id,
          childId: dto.childId,
          type: TransactionType.SESSION_CHARGE,
          direction: TransactionDirection.OUT,
          amount: dto.amount,
          description: dto.description,
          idempotencyKey: requestKey,
        },
      });

      // Calculate net state of parent inside transaction
      const rows = await tx.transaction.findMany({
        where: { parentId: parent.id },
        select: { amount: true, direction: true, type: true, parentId: true },
      });
      const finState = calculateFinancialState(rows, parent.id);

      let notif = null;
      if (finState.debt > 0) {
        // Balans tugadi, qarzdorlik yozildi -> DEBT bildirishnomasi
        notif = await this.notifications.create(
          {
            userId: parent.userId,
            type: NotificationType.DEBT,
            title: 'Qarzdorlik haqida ogohlantirish',
            message: `Muolaja narxi hisoblandi (${dto.amount.toLocaleString()} UZS). Balansingizda mablag' tugadi, joriy qarzdorlik: ${finState.debt.toLocaleString()} UZS. Iltimos, hisobingizni to'ldiring.`,
            relatedEntity: 'Transaction',
            relatedEntityId: chargeTx.id,
            dedupeKey: `debt-alert:${chargeTx.id}`,
            allowSms: false,
          },
          tx,
        );
      }

      await tx.activityLog.create({
        data: {
          userId: actorId,
          action: 'CHARGE_RECORDED',
          entity: 'Transaction',
          entityId: chargeTx.id,
          description: `Recorded service charge of ${dto.amount} UZS for parent ${parent.user.fullName}`,
        },
      });

      return { chargeTx, notif, parentUserId: parent.userId, finState };
      });

    // Post-commit side-effect: Broadcast realtime event only after successful commit!
      if (result.notif && result.parentUserId) {
        this.notifications.emitRealtimeNotification(result.parentUserId, result.notif);
      }

      return {
        transaction: result.chargeTx,
        balance: result.finState.balance,
        debt: result.finState.debt,
      };
    } catch (error) {
      if (this.isUnique(error)) {
        const requestKey = `charge:${dto.idempotencyKey}`;
        const [duplicate, parent] = await Promise.all([
          this.prisma.transaction.findUnique({ where: { idempotencyKey: requestKey } }),
          this.prisma.parent.findFirst({
            where: { OR: [{ id: dto.parentId }, { userId: dto.parentId }] },
            select: { id: true },
          }),
        ]);
        if (
          duplicate &&
          parent &&
          duplicate.parentId === parent.id &&
          duplicate.childId === (dto.childId ?? null) &&
          duplicate.amount === dto.amount &&
          duplicate.description === dto.description
        ) {
          const state = await this.stateForParent(parent.id);
          return { transaction: duplicate, balance: state.balance, debt: state.debt };
        }
        throw new ConflictException('Duplicate charge request');
      }
      throw error;
    }
  }

  async paymentById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        parent: { include: { user: { select: { fullName: true, phone: true } } } },
        child: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.presentPayment(payment);
  }

  async transactionById(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        parent: { include: { user: { select: { fullName: true } } } },
        child: { select: { firstName: true, lastName: true } },
      },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  async payments(parentId?: string, childId?: string, page = 1, limit = 50, from?: string, to?: string) {
    const where: Prisma.PaymentWhereInput = {
      parentId,
      childId,
      ...(from || to ? { paidAt: buildDateRange(from, to) } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          parent: { include: { user: { select: { fullName: true, phone: true } } } },
          child: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items: items.map((item) => this.presentPayment(item)), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async transactions(parentId?: string, childId?: string, page = 1, limit = 50, from?: string, to?: string) {
    const where: Prisma.TransactionWhereInput = {
      parentId,
      childId,
      ...(from || to ? { createdAt: buildDateRange(from, to) } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: {
          parent: { include: { user: { select: { fullName: true } } } },
          child: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async stateForParent(parentId: string) {
    const parent = await this.prisma.parent.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) throw new NotFoundException('Parent not found');
    const rows = await this.prisma.transaction.findMany({
      where: { parentId },
      select: { amount: true, direction: true, type: true, parentId: true },
    });
    return calculateFinancialState(rows, parentId);
  }

  async allDebtors() {
    const grouped = await this.prisma.transaction.groupBy({
      by: ['parentId', 'childId', 'direction'],
      where: { type: { not: TransactionType.EXPENSE }, parentId: { not: null } },
      _sum: { amount: true },
      orderBy: { parentId: 'asc' },
    });
    const netByParent = new Map<string, number>();
    const netByChild = new Map<string, number>();
    for (const row of grouped) {
      if (!row.parentId) continue;
      const amount = row._sum?.amount ?? 0;
      const current = netByParent.get(row.parentId) ?? 0;
      const delta = row.direction === TransactionDirection.IN ? amount : -amount;
      netByParent.set(row.parentId, current + delta);
      if (row.childId) {
        const childKey = `${row.parentId}:${row.childId}`;
        netByChild.set(childKey, (netByChild.get(childKey) ?? 0) + delta);
      }
    }
    const debtorIds = Array.from(netByParent.entries())
      .filter(([, net]) => net < 0)
      .map(([parentId, net]) => ({ parentId, debt: -net }))
      .sort((a, b) => b.debt - a.debt);

    // Enrich with parent user info
    const parents = await this.prisma.parent.findMany({
      where: { id: { in: debtorIds.map((d) => d.parentId) } },
      include: {
        user: { select: { fullName: true, phone: true } },
        children: { include: { child: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    const parentMap = new Map(parents.map((p) => [p.id, p]));
    return debtorIds.map((d) => {
      const parent = parentMap.get(d.parentId);
      const children = (parent?.children ?? []).map(({ child }) => {
        const net = netByChild.get(`${d.parentId}:${child.id}`) ?? 0;
        return { ...child, fullName: `${child.firstName} ${child.lastName}`.trim(), debt: Math.max(0, -net) };
      });
      return { ...d, parent, children };
    });
  }

  async parentBalance(parentId: string, user: RequestUser) {
    this.assertFinancialRole(user);
    if (user.role === Role.PARENT) {
      const parent = await this.prisma.parent.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!parent || parent.id !== parentId) throw new ForbiddenException('Access denied');
    }
    return this.stateForParent(parentId);
  }

  async financialSummary(parentId: string, user: RequestUser) {
    this.assertFinancialRole(user);
    if (user.role === Role.PARENT) {
      const parent = await this.prisma.parent.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!parent || parent.id !== parentId) throw new ForbiddenException('Access denied');
    }
    const [state, recentPayments, recentTransactions] = await Promise.all([
      this.stateForParent(parentId),
      this.prisma.payment.findMany({
        where: { parentId },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
      this.prisma.transaction.findMany({
        where: { parentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { ...state, recentPayments, recentTransactions };
  }

  async stateForChild(childId: string, user: RequestUser) {
    this.assertFinancialRole(user);
    if (user.role === Role.PARENT) {
      const parentProfile = await this.prisma.parent.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!parentProfile) throw new ForbiddenException('Parent profile not found');
      const relation = await this.prisma.childParent.findUnique({
        where: { childId_parentId: { childId, parentId: parentProfile.id } },
        select: { id: true },
      });
      if (!relation) throw new ForbiddenException('Access denied');
    }
    const child = await this.prisma.child.findUnique({ where: { id: childId }, select: { id: true } });
    if (!child) throw new NotFoundException('Child not found');
    const relations = await this.prisma.childParent.findMany({ where: { childId }, select: { parentId: true } });
    const values = await Promise.all(
      relations.map(async ({ parentId }) => ({ parentId, ...(await this.stateForParent(parentId)) })),
    );
    return values;
  }


  private isUnique(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
    );
  }

  private isSerializationConflict(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
  }

  private async runSerializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isSerializationConflict(error) || attempt === maxAttempts) throw error;
      }
    }
    throw new Error('Serializable transaction retry exhausted');
  }

  private assertFinancialRole(user: RequestUser): void {
    const allowedRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.PARENT];
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Financial data is restricted to administrators and the owning parent');
    }
  }

  private presentPayment<T extends {
    parent: { id: string; user: { fullName: string; phone: string } };
    child: { id: string; firstName: string; lastName: string };
  }>(payment: T) {
    return {
      ...payment,
      payer: {
        id: payment.parent.id,
        fullName: payment.parent.user.fullName,
        phone: payment.parent.user.phone,
      },
      child: {
        ...payment.child,
        fullName: `${payment.child.firstName} ${payment.child.lastName}`.trim(),
      },
    };
  }
}
