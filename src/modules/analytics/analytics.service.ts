import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceStatus, TransactionDirection, TransactionType } from '@prisma/client';

type Period = 'today' | 'yesterday' | 'last7Days' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear';

function tashkentNow(): Date {
  // Asia/Tashkent = UTC+5, no DST
  return new Date(Date.now() + 5 * 60 * 60 * 1000);
}

function periodBounds(period: Period): { from: Date; to: Date } {
  const now = tashkentNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const todayStart = new Date(Date.UTC(y, m, d));

  switch (period) {
    case 'today':
      return { from: todayStart, to: new Date(todayStart.getTime() + 86_400_000) };
    case 'yesterday': {
      const ys = new Date(todayStart.getTime() - 86_400_000);
      return { from: ys, to: todayStart };
    }
    case 'last7Days':
      return { from: new Date(todayStart.getTime() - 7 * 86_400_000), to: new Date(todayStart.getTime() + 86_400_000) };
    case 'thisWeek': {
      const dow = now.getUTCDay(); // 0=Sun
      const weekStart = new Date(todayStart.getTime() - dow * 86_400_000);
      return { from: weekStart, to: new Date(todayStart.getTime() + 86_400_000) };
    }
    case 'thisMonth':
      return { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 1)) };
    case 'lastMonth':
      return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
    case 'thisYear':
      return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)) };
    default:
      return { from: todayStart, to: new Date(todayStart.getTime() + 86_400_000) };
  }
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const todayBounds = periodBounds('today');
    const monthBounds = periodBounds('thisMonth');
    const yearBounds = periodBounds('thisYear');

    const [
      totalRevenueAgg,
      todayRevenueAgg,
      monthlyRevenueAgg,
      yearlyRevenueAgg,
      totalDebtRows,
      monthlyDebtRows,
      activeChildrenCount,
      activeSpecialistsCount,
      todayAttendanceCount,
    ] = await this.prisma.$transaction([
      // total revenue = all PAYMENT IN transactions
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.PAYMENT, direction: TransactionDirection.IN },
        _sum: { amount: true },
      }),
      // today revenue
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.PAYMENT, direction: TransactionDirection.IN, createdAt: { gte: todayBounds.from, lt: todayBounds.to } },
        _sum: { amount: true },
      }),
      // monthly revenue
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.PAYMENT, direction: TransactionDirection.IN, createdAt: { gte: monthBounds.from, lt: monthBounds.to } },
        _sum: { amount: true },
      }),
      // yearly revenue
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.PAYMENT, direction: TransactionDirection.IN, createdAt: { gte: yearBounds.from, lt: yearBounds.to } },
        _sum: { amount: true },
      }),
      // total debt: derive net per parent, sum negatives
      this.prisma.transaction.findMany({
        where: { type: { not: TransactionType.EXPENSE } },
        select: { parentId: true, direction: true, amount: true },
      }),
      // monthly charges to calculate monthly debt created
      this.prisma.transaction.findMany({
        where: { type: TransactionType.SESSION_CHARGE, createdAt: { gte: monthBounds.from, lt: monthBounds.to } },
        select: { amount: true },
      }),
      // active children
      this.prisma.child.count({ where: { status: 'ACTIVE' } }),
      // active specialists
      this.prisma.specialist.count({ where: { status: 'ACTIVE' } }),
      // today attendances
      this.prisma.attendance.count({ where: { date: { gte: todayBounds.from, lt: todayBounds.to } } }),
    ]);

    const attendanceStatuses = await this.prisma.attendance.groupBy({
      by: ['status'],
      _count: { id: true },
      orderBy: { status: 'asc' },
    });

    // Derive total debt from ledger
    const netByParent = new Map<string, number>();
    for (const row of totalDebtRows) {
      if (!row.parentId) continue;
      const current = netByParent.get(row.parentId) ?? 0;
      const delta = row.direction === TransactionDirection.IN ? row.amount : -row.amount;
      netByParent.set(row.parentId, current + delta);
    }
    let totalDebt = 0;
    let currentBalance = 0;
    for (const net of netByParent.values()) {
      if (net < 0) totalDebt += -net;
      else currentBalance += net;
    }

    const monthlyCharge = monthlyDebtRows.reduce((acc, r) => acc + r.amount, 0);

    const statusMap = new Map<AttendanceStatus, number>();
    for (const s of attendanceStatuses) {
      statusMap.set(s.status, s._count.id);
    }

    const totalAttendances = attendanceStatuses.reduce((a, s) => a + s._count.id, 0);
    const present = statusMap.get(AttendanceStatus.PRESENT) ?? 0;
    const absent = statusMap.get(AttendanceStatus.ABSENT) ?? 0;
    const noShow = statusMap.get(AttendanceStatus.NO_SHOW) ?? 0;

    return {
      totalRevenue: totalRevenueAgg._sum.amount ?? 0,
      todayRevenue: todayRevenueAgg._sum.amount ?? 0,
      monthlyRevenue: monthlyRevenueAgg._sum.amount ?? 0,
      yearlyRevenue: yearlyRevenueAgg._sum.amount ?? 0,
      totalDebt,
      monthlyDebt: monthlyCharge,
      currentBalance,
      activeChildren: activeChildrenCount,
      activeSpecialists: activeSpecialistsCount,
      todayAttendance: todayAttendanceCount,
      attendanceRate: totalAttendances > 0 ? ((present / totalAttendances) * 100).toFixed(1) : '0.0',
      absenceRate: totalAttendances > 0 ? ((absent / totalAttendances) * 100).toFixed(1) : '0.0',
      noShowRate: totalAttendances > 0 ? ((noShow / totalAttendances) * 100).toFixed(1) : '0.0',
    };
  }

  async revenue(period: Period, from?: string, to?: string) {
    const bounds = from && to ? { from: new Date(from), to: new Date(to) } : periodBounds(period);
    const [payments, refunds, charges] = await this.prisma.$transaction([
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.PAYMENT, direction: TransactionDirection.IN, createdAt: { gte: bounds.from, lt: bounds.to } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.REFUND, direction: TransactionDirection.OUT, createdAt: { gte: bounds.from, lt: bounds.to } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: TransactionType.SESSION_CHARGE, direction: TransactionDirection.OUT, createdAt: { gte: bounds.from, lt: bounds.to } },
        _sum: { amount: true },
      }),
    ]);
    return {
      period,
      from: bounds.from,
      to: bounds.to,
      totalPayments: payments._sum.amount ?? 0,
      totalRefunds: refunds._sum.amount ?? 0,
      totalCharges: charges._sum.amount ?? 0,
      netRevenue: (payments._sum.amount ?? 0) - (refunds._sum.amount ?? 0),
    };
  }

  async debt(period: Period) {
    const bounds = periodBounds(period);
    // Find all families with net < 0 (in debt)
    const rows = await this.prisma.transaction.findMany({
      where: { type: { not: TransactionType.EXPENSE } },
      select: { parentId: true, direction: true, amount: true, type: true },
    });
    const netByParent = new Map<string, number>();
    for (const row of rows) {
      if (!row.parentId) continue;
      const current = netByParent.get(row.parentId) ?? 0;
      const delta = row.direction === TransactionDirection.IN ? row.amount : -row.amount;
      netByParent.set(row.parentId, current + delta);
    }
    const debtors = Array.from(netByParent.entries())
      .filter(([, net]) => net < 0)
      .map(([parentId, net]) => ({ parentId, debt: -net }))
      .sort((a, b) => b.debt - a.debt);

    // New debt created in period = session charges in period
    const newDebtAgg = await this.prisma.transaction.aggregate({
      where: { type: TransactionType.SESSION_CHARGE, createdAt: { gte: bounds.from, lt: bounds.to } },
      _sum: { amount: true },
    });

    return {
      period,
      totalDebtors: debtors.length,
      totalDebt: debtors.reduce((a, d) => a + d.debt, 0),
      newDebtInPeriod: newDebtAgg._sum.amount ?? 0,
      topDebtors: debtors.slice(0, 20),
    };
  }

  async attendance(period: Period) {
    const bounds = periodBounds(period);
    const [byStatus, bySpecialist] = await this.prisma.$transaction([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { date: { gte: bounds.from, lt: bounds.to } },
        _count: { id: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.attendance.groupBy({
        by: ['specialistId'],
        where: { date: { gte: bounds.from, lt: bounds.to }, specialistId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);
    return { period, byStatus, bySpecialist };
  }

  async children(period: Period) {
    const bounds = periodBounds(period);
    const [byStatus, newEnrollments, byGender] = await this.prisma.$transaction([
      this.prisma.child.groupBy({ by: ['status'], _count: { id: true }, orderBy: { status: 'asc' } }),
      this.prisma.child.count({ where: { createdAt: { gte: bounds.from, lt: bounds.to } } }),
      this.prisma.child.groupBy({ by: ['gender'], _count: { id: true }, orderBy: { gender: 'asc' } }),
    ]);
    return { period, byStatus, newEnrollments, byGender };
  }

  async specialists() {
    const [byStatus, attendanceBySpecialist] = await this.prisma.$transaction([
      this.prisma.specialist.groupBy({ by: ['status'], _count: { id: true }, orderBy: { status: 'asc' } }),
      this.prisma.attendance.groupBy({
        by: ['specialistId'],
        where: { specialistId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
    ]);
    return { byStatus, attendanceBySpecialist };
  }

  async notificationStats() {
    const [byType, byChannel, deliveryStatus] = await this.prisma.$transaction([
      this.prisma.notification.groupBy({ by: ['type'], _count: { _all: true }, orderBy: { type: 'asc' } }),
      this.prisma.notificationDelivery.groupBy({ by: ['channel'], _count: { _all: true }, orderBy: { channel: 'asc' } }),
      this.prisma.notificationDelivery.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const total = await this.prisma.notification.count();
    const unread = await this.prisma.notification.count({ where: { readAt: null } });
    return { total, unread, byType, byChannel, deliveryStatus };
  }
}
