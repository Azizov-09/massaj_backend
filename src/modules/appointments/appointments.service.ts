import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma, Role, ServiceStatus, SpecialistStatus, UserStatus } from '@prisma/client';
import { RequestUser } from '../../common/types/request-user.type';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppointmentQueryDto, CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointments.dto';

const relations = {
  child: { select: { id: true, firstName: true, lastName: true } },
  parent: { select: { id: true, user: { select: { id: true, fullName: true, phone: true } } } },
  specialist: { select: { id: true, user: { select: { fullName: true } } } },
  service: { select: { id: true, name: true, durationMinutes: true, price: true } },
  attendance: true,
} satisfies Prisma.AppointmentInclude;

const editableAppointmentStatuses: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
];
const attendanceOnlyStatuses: AppointmentStatus[] = [AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateAppointmentDto, user: RequestUser) {
    const prepared = await this.validateInput(dto);
    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertAvailable(tx, dto.childId, dto.specialistId, prepared.startAt, prepared.endAt);
      const appointment = await tx.appointment.create({
        data: { ...dto, startAt: prepared.startAt, endAt: prepared.endAt },
        include: relations,
      });
      const notification = await this.notifications.create(
        {
          userId: prepared.parentUserId,
          type: 'APPOINTMENT',
          title: 'Yangi qabul belgilandi',
          message: `${appointment.service.name} qabuli ${appointment.startAt.toISOString()} vaqtiga belgilandi.`,
          relatedEntity: 'Appointment',
          relatedEntityId: appointment.id,
          dedupeKey: `appointment-created:${appointment.id}`,
          allowSms: false,
        },
        tx,
      );
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'APPOINTMENT_CREATED',
          entity: 'Appointment',
          entityId: appointment.id,
          description: `Scheduled appointment for child ${appointment.childId}`,
        },
      });
      return { appointment, notification };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result.notification) this.notifications.emitRealtimeNotification(prepared.parentUserId, result.notification);
    return result.appointment;
  }

  async list(query: AppointmentQueryDto, user: RequestUser) {
    const where: Prisma.AppointmentWhereInput = {
      ...(await this.accessWhere(user)),
      childId: query.childId,
      specialistId: query.specialistId,
      status: query.status,
      startAt: this.dateRange(query.from, query.to),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: relations,
        orderBy: { startAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return { items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async get(id: string, user: RequestUser) {
    const row = await this.prisma.appointment.findFirst({ where: { id, ...(await this.accessWhere(user)) }, include: relations });
    if (!row) throw new NotFoundException('Appointment not found');
    return row;
  }

  async update(id: string, dto: UpdateAppointmentDto, user: RequestUser) {
    const existing = await this.prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Appointment not found');
    if (!editableAppointmentStatuses.includes(existing.status)) {
      throw new ConflictException('Only scheduled or confirmed appointments can be edited');
    }
    const prepared = await this.validateInput({
      childId: existing.childId,
      parentId: existing.parentId,
      specialistId: dto.specialistId ?? existing.specialistId,
      serviceId: dto.serviceId ?? existing.serviceId,
      startAt: dto.startAt ?? existing.startAt.toISOString(),
    });
    return this.prisma.$transaction(async (tx) => {
      await this.assertAvailable(
        tx,
        existing.childId,
        dto.specialistId ?? existing.specialistId,
        prepared.startAt,
        prepared.endAt,
        id,
      );
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          specialistId: dto.specialistId,
          serviceId: dto.serviceId,
          startAt: prepared.startAt,
          endAt: prepared.endAt,
          notes: dto.notes,
        },
        include: relations,
      });
      await tx.activityLog.create({
        data: { userId: user.id, action: 'APPOINTMENT_UPDATED', entity: 'Appointment', entityId: id, description: 'Appointment schedule updated' },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateStatus(id: string, status: AppointmentStatus, user: RequestUser) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (user.role === Role.SPECIALIST) {
      const specialist = await this.prisma.specialist.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!specialist || specialist.id !== appointment.specialistId) throw new ForbiddenException('Appointment belongs to another specialist');
    }
    if (attendanceOnlyStatuses.includes(status)) {
      throw new BadRequestException('Record attendance to complete or mark an appointment as no-show');
    }
    const allowed: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
      SCHEDULED: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
      CONFIRMED: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED],
      IN_PROGRESS: [AppointmentStatus.CANCELLED],
    };
    if (!(allowed[appointment.status] ?? []).includes(status)) {
      throw new ConflictException(`Cannot change appointment from ${appointment.status} to ${status}`);
    }
    return this.prisma.appointment.update({ where: { id }, data: { status }, include: relations });
  }

  private async validateInput(dto: Pick<CreateAppointmentDto, 'childId' | 'parentId' | 'specialistId' | 'serviceId' | 'startAt'>) {
    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime())) throw new BadRequestException('Invalid appointment start time');
    const [relation, child, specialist, service, settings] = await Promise.all([
      this.prisma.childParent.findUnique({
        where: { childId_parentId: { childId: dto.childId, parentId: dto.parentId } },
        select: { parent: { select: { userId: true, user: { select: { status: true } } } } },
      }),
      this.prisma.child.findUnique({ where: { id: dto.childId }, select: { status: true } }),
      this.prisma.specialist.findUnique({
        where: { id: dto.specialistId },
        select: { status: true, workingDays: true, user: { select: { status: true } } },
      }),
      this.prisma.service.findUnique({ where: { id: dto.serviceId }, select: { status: true, durationMinutes: true } }),
      this.prisma.centerSettings.findFirst({ orderBy: { createdAt: 'asc' }, select: { timezone: true } }),
    ]);
    if (!relation) throw new BadRequestException('Parent must be related to the child');
    if (relation.parent.user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Parent account must be active');
    }
    if (!child || child.status !== 'ACTIVE') throw new BadRequestException('Child must be active');
    if (
      !specialist ||
      specialist.status !== SpecialistStatus.ACTIVE ||
      specialist.user.status !== UserStatus.ACTIVE
    ) {
      throw new BadRequestException('Specialist must be active');
    }
    if (!service || service.status !== ServiceStatus.ACTIVE) throw new BadRequestException('Service must be active');
    const isoWeekday = this.isoWeekday(startAt, settings?.timezone ?? 'Asia/Tashkent');
    if (!specialist.workingDays.includes(isoWeekday)) {
      throw new ConflictException(`Specialist is not available on ISO weekday ${isoWeekday}`);
    }
    return {
      startAt,
      endAt: new Date(startAt.getTime() + service.durationMinutes * 60_000),
      parentUserId: relation.parent.userId,
    };
  }

  private async assertAvailable(
    tx: Prisma.TransactionClient,
    childId: string,
    specialistId: string,
    startAt: Date,
    endAt: Date,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await tx.appointment.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        status: { not: AppointmentStatus.CANCELLED },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        OR: [{ childId }, { specialistId }],
      },
      select: { id: true },
    });
    if (conflict) throw new ConflictException('Child or specialist already has an overlapping appointment');
  }

  private async accessWhere(user: RequestUser): Promise<Prisma.AppointmentWhereInput> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return {};
    if (user.role === Role.SPECIALIST) return { specialist: { userId: user.id } };
    if (user.role === Role.PARENT) return { parent: { userId: user.id } };
    throw new ForbiddenException('Access denied');
  }

  private dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      if (!to.includes('T')) end.setUTCHours(23, 59, 59, 999);
      range.lte = end;
    }
    if (range.gte && range.lte && range.gte > range.lte) throw new BadRequestException('from must be before or equal to to');
    return range;
  }

  private isoWeekday(value: Date, timeZone: string): number {
    try {
      const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(value);
      const weekdays: Record<string, number> = {
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
        Sun: 7,
      };
      const result = weekdays[weekday];
      if (!result) throw new Error('Unknown weekday');
      return result;
    } catch {
      throw new BadRequestException(`Invalid center timezone configuration: ${timeZone}`);
    }
  }
}
