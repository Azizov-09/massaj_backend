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
import { RecordPaymentDto, RefundDto } from './dto/finance.dto';
import { RequestUser } from '../../common/types/request-user.type';

export interface SessionChargeInput {
  sessionId: string;
  appointmentId: string;
  parentId: string;
  parentUserId: string;
  childId: string;
  amount: number;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async recordPayment(dto: RecordPaymentDto, actorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Idempotency check
        if (dto.idempotencyKey) {
          const duplicate = await tx.payment.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
          if (duplicate) return duplicate;
        }
        // Verify parent-child relationship
        const relation = await tx.childParent.findUnique({
          where: { childId_parentId: { childId: dto.childId, parentId: dto.parentId } },
          include: { parent: { select: { userId: true } } },
        });
        if (!relation) throw new BadRequestException('Parent must be related to the child');

        const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
        if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('Invalid payment date');

        const payment = await tx.payment.create({
          data: {
            parentId: dto.parentId,
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
            parentId: dto.parentId,
            childId: dto.childId,
            type: TransactionType.PAYMENT,
            direction: TransactionDirection.IN,
            amount: dto.amount,
            description: `Manual ${dto.method.toLowerCase()} payment`,
            idempotencyKey: dto.idempotencyKey
              ? `payment:${dto.idempotencyKey}`
              : `payment:${payment.id}`,
          },
        });

        await this.notifications.create(
          {
            userId: relation.parent.userId,
            type: NotificationType.PAYMENT,
            title: 'Payment received',
            message: `A payment of ${dto.amount.toLocaleString()} UZS was recorded.`,
            relatedEntity: 'Payment',
            relatedEntityId: payment.id,
            dedupeKey: `payment-received:${payment.id}`,
            allowSms: true,
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

        await tx.outboxEvent.create({
          data: {
            eventType: 'PAYMENT_RECORDED',
            aggregateType: 'Payment',
            aggregateId: payment.id,
            payload: { paymentId: payment.id },
          },
        });

        return payment;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (this.isUnique(error)) throw new ConflictException('Duplicate payment request');
      throw error;
    }
  }

  async refund(paymentId: string, dto: RefundDto, actorId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { parent: { select: { userId: true } } },
        });
        if (!payment) throw new NotFoundException('Payment not found');

        // Check cumulative refunds don't exceed original amount
        const aggregate = await tx.transaction.aggregate({
          where: {
            type: TransactionType.REFUND,
            description: { startsWith: `Refund for payment ${payment.id}` },
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
            type: TransactionType.REFUND,
            direction: TransactionDirection.OUT,
            amount: dto.amount,
            description: `Refund for payment ${payment.id}${dto.note ? `: ${dto.note}` : ''}`,
            idempotencyKey: `refund:${payment.id}:${alreadyRefunded + dto.amount}`,
          },
        });

        await this.notifications.create(
          {
            userId: payment.parent.userId,
            type: NotificationType.PAYMENT,
            title: 'Payment refund recorded',
            message: `A refund of ${dto.amount.toLocaleString()} UZS was recorded.`,
            relatedEntity: 'Transaction',
            relatedEntityId: refund.id,
            dedupeKey: `refund:${refund.id}`,
            allowSms: true,
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

        await tx.outboxEvent.create({
          data: {
            eventType: 'PAYMENT_REFUNDED',
            aggregateType: 'Payment',
            aggregateId: payment.id,
            payload: { paymentId: payment.id, transactionId: refund.id },
          },
        });

        return refund;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (this.isUnique(error)) throw new ConflictException('Duplicate refund request');
      throw error;
    }
  }

  async paymentById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        parent: { include: { user: { select: { fullName: true, phone: true } } } },
        child: { select: { firstName: true, lastName: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
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

  async payments(parentId?: string, childId?: string, page = 1, limit = 50) {
    const where: Prisma.PaymentWhereInput = { parentId, childId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          parent: { include: { user: { select: { fullName: true } } } },
          child: { select: { firstName: true, lastName: true } },
        },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async transactions(parentId?: string, childId?: string, page = 1, limit = 50) {
    const where: Prisma.TransactionWhereInput = { parentId, childId };
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
    const rows = await this.prisma.transaction.findMany({
      where: { type: { not: TransactionType.EXPENSE }, parentId: { not: null } },
      select: { parentId: true, direction: true, amount: true, type: true },
    });
    const netByParent = new Map<string, number>();
    for (const row of rows) {
      if (!row.parentId) continue;
      const current = netByParent.get(row.parentId) ?? 0;
      const delta = row.direction === TransactionDirection.IN ? row.amount : -row.amount;
      netByParent.set(row.parentId, current + delta);
    }
    const debtorIds = Array.from(netByParent.entries())
      .filter(([, net]) => net < 0)
      .map(([parentId, net]) => ({ parentId, debt: -net }))
      .sort((a, b) => b.debt - a.debt);

    // Enrich with parent user info
    const parents = await this.prisma.parent.findMany({
      where: { id: { in: debtorIds.map((d) => d.parentId) } },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    const parentMap = new Map(parents.map((p) => [p.id, p]));
    return debtorIds.map((d) => ({
      ...d,
      parent: parentMap.get(d.parentId),
    }));
  }

  async parentBalance(parentId: string, user: RequestUser) {
    // PARENT role may only access their own balance
    if (user.role === Role.PARENT) {
      const parent = await this.prisma.parent.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!parent || parent.id !== parentId) throw new ForbiddenException('Access denied');
    }
    return this.stateForParent(parentId);
  }

  async financialSummary(parentId: string, user: RequestUser) {
    // PARENT role may only access their own summary
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
    // PARENT can only see children they own
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

  async chargeCompletedSession(
    input: SessionChargeInput,
    actorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.transaction.create({
      data: {
        parentId: input.parentId,
        childId: input.childId,
        appointmentId: input.appointmentId,
        sessionId: input.sessionId,
        type: TransactionType.SESSION_CHARGE,
        direction: TransactionDirection.OUT,
        amount: input.amount,
        description: 'Completed rehabilitation session charge',
        idempotencyKey: `session-charge:${input.sessionId}`,
      },
    });

    const rows = await tx.transaction.findMany({
      where: { parentId: input.parentId },
      select: { amount: true, direction: true, type: true, parentId: true },
    });
    const state = calculateFinancialState(rows, input.parentId);

    await this.notifications.create(
      {
        userId: input.parentUserId,
        type: NotificationType.SESSION,
        title: 'Session completed',
        message: `A session charge of ${input.amount.toLocaleString()} UZS was recorded.`,
        relatedEntity: 'Session',
        relatedEntityId: input.sessionId,
        dedupeKey: `session-completed:${input.sessionId}`,
        allowSms: false,
      },
      tx,
    );

    if (state.debt > 0) {
      await this.notifications.create(
        {
          userId: input.parentUserId,
          type: NotificationType.DEBT,
          title: 'Outstanding balance',
          message: `Sizda xizmatlar bo'yicha ${state.debt.toLocaleString()} UZS qarzdorlik mavjud.`,
          relatedEntity: 'Session',
          relatedEntityId: input.sessionId,
          dedupeKey: `debt-session:${input.sessionId}`,
          allowSms: true,
        },
        tx,
      );
    }

    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: 'SESSION_CHARGED',
        entity: 'Session',
        entityId: input.sessionId,
        description: `Created immutable session charge of ${input.amount} UZS`,
      },
    });

    await tx.outboxEvent.create({
      data: {
        eventType: 'SESSION_COMPLETED',
        aggregateType: 'Session',
        aggregateId: input.sessionId,
        payload: { sessionId: input.sessionId, debt: state.debt },
      },
    });
  }

  private isUnique(error: unknown): boolean {
    return (
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
    );
  }
}
