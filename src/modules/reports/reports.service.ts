import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceStatus, TransactionDirection, TransactionType } from '@prisma/client';

export interface ReportFilter {
  from?: string;
  to?: string;
  specialistId?: string;
  parentId?: string;
  childId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

function dateRange(from?: string, to?: string) {
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
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async financial(filter: ReportFilter) {
    const { page = 1, limit = 50 } = filter;
    const where = {
      createdAt: dateRange(filter.from, filter.to),
      parentId: filter.parentId,
      childId: filter.childId,
      type: filter.status as TransactionType | undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: {
          parent: { include: { user: { select: { fullName: true, phone: true } } } },
          child: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    // Summary aggregation
    const inAgg = await this.prisma.transaction.aggregate({
      where: { ...where, direction: TransactionDirection.IN },
      _sum: { amount: true },
    });
    const outAgg = await this.prisma.transaction.aggregate({
      where: { ...where, direction: TransactionDirection.OUT, type: { not: TransactionType.EXPENSE } },
      _sum: { amount: true },
    });
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalIn: inAgg._sum.amount ?? 0,
        totalOut: outAgg._sum.amount ?? 0,
        net: (inAgg._sum.amount ?? 0) - (outAgg._sum.amount ?? 0),
      },
    };
  }

  async attendance(filter: ReportFilter) {
    const { page = 1, limit = 50 } = filter;
    const where = {
      date: dateRange(filter.from, filter.to),
      childId: filter.childId,
      specialistId: filter.specialistId,
      status: filter.status as AttendanceStatus | undefined,
    };
    const [items, total, byStatus] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        include: {
          child: { select: { firstName: true, lastName: true } },
          specialist: { include: { user: { select: { fullName: true } } } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, byStatus };
  }

  async children(filter: ReportFilter) {
    const { page = 1, limit = 50 } = filter;
    const where = {
      createdAt: dateRange(filter.from, filter.to),
      status: filter.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.child.findMany({
        where,
        include: {
          parents: { include: { parent: { include: { user: { select: { fullName: true, phone: true } } } } } },
          _count: { select: { attendances: true, assessments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.child.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async specialists(filter: ReportFilter) {
    const { page = 1, limit = 50 } = filter;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.specialist.findMany({
        include: {
          user: { select: { fullName: true, phone: true, status: true } },
          _count: { select: { attendances: true, assessments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.specialist.count(),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async progress(filter: ReportFilter) {
    const { page = 1, limit = 50 } = filter;
    const where = {
      createdAt: dateRange(filter.from, filter.to),
      childId: filter.childId,
      specialistId: filter.specialistId,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.progressEntry.findMany({
        where,
        include: {
          child: { select: { firstName: true, lastName: true } },
          specialist: { include: { user: { select: { fullName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.progressEntry.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async notifications(filter: ReportFilter) {
    const { page = 1, limit = 50 } = filter;
    const [deliveries, total, byStatus] = await this.prisma.$transaction([
      this.prisma.notificationDelivery.findMany({
        where: { createdAt: dateRange(filter.from, filter.to) },
        include: {
          notification: { select: { type: true, title: true, user: { select: { fullName: true, phone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationDelivery.count({ where: { createdAt: dateRange(filter.from, filter.to) } }),
      this.prisma.notificationDelivery.groupBy({
        by: ['status'],
        where: { createdAt: dateRange(filter.from, filter.to) },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);
    return { items: deliveries, meta: { page, limit, total, totalPages: Math.ceil(total / limit) }, byStatus };
  }
}
