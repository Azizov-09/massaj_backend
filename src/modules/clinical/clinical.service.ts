import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AccessService } from '../../common/services/access.service';
import { RequestUser } from '../../common/types/request-user.type';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ClinicalListQueryDto,
  CreateAssessmentDto,
  CreateAttendanceDto,
  CreateProgressDto,
  UpdateAssessmentDto,
  UpdateAttendanceDto,
  UpdateProgressDto,
} from './dto/clinical.dto';

type ClinicalRelations = {
  child: { id: string; firstName: string; lastName: string };
  specialist: { id: string; user: { fullName: string } };
};

type ProgressRelations = ClinicalRelations & {
  createdBy: { id: string; fullName: string; role: Role } | null;
};

const assessmentRelations = {
  child: { select: { id: true, firstName: true, lastName: true } },
  specialist: { select: { id: true, user: { select: { fullName: true } } } },
} satisfies Prisma.AssessmentInclude;

const progressRelations = {
  child: { select: { id: true, firstName: true, lastName: true } },
  specialist: { select: { id: true, user: { select: { fullName: true } } } },
  createdBy: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.ProgressEntryInclude;

@Injectable()
export class ClinicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async attendance(dto: CreateAttendanceDto, user: RequestUser) {
    await this.access.assertChildAccess(user, dto.childId);
    let specialistId: string | undefined;
    if (user.role === Role.SPECIALIST) specialistId = await this.access.currentSpecialistId(user.id);
    else if (dto.specialistId) {
      specialistId = dto.specialistId;
      await this.assertSpecialistChild(specialistId, dto.childId);
    }
    const date = dto.date ? this.requireNotFuture(dto.date, 'Attendance date') : new Date();
    return this.prisma.attendance.create({
      data: { childId: dto.childId, specialistId, status: dto.status, note: dto.note, date },
    });
  }

  async updateAttendance(id: string, dto: UpdateAttendanceDto, user: RequestUser) {
    const row = await this.prisma.attendance.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attendance not found');
    if (row.specialistId) await this.assertSpecialistOwner(row.specialistId, user);
    else if (user.role === Role.SPECIALIST) {
      throw new ForbiddenException('Only administrators or assigned specialists can update attendance');
    }
    return this.prisma.attendance.update({ where: { id }, data: dto });
  }

  async attendances(childId: string, user: RequestUser) {
    await this.access.assertChildAccess(user, childId);
    return this.prisma.attendance.findMany({
      where: { childId },
      include: { specialist: { include: { user: { select: { fullName: true } } } } },
      orderBy: { date: 'desc' },
    });
  }

  async assessments(childId: string, user: RequestUser) {
    await this.access.assertChildAccess(user, childId);
    const rows = await this.prisma.assessment.findMany({
      where: { childId }, include: assessmentRelations, orderBy: { assessedAt: 'desc' },
    });
    return rows.map((row) => this.presentAssessment(row));
  }

  async listAssessments(query: ClinicalListQueryDto, user: RequestUser) {
    const where = await this.assessmentWhere(query, user);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.assessment.findMany({
        where,
        include: assessmentRelations,
        orderBy: { assessedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.assessment.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.presentAssessment(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async assessmentById(id: string, user: RequestUser) {
    const row = await this.prisma.assessment.findUnique({ where: { id }, include: assessmentRelations });
    if (!row) throw new NotFoundException('Assessment not found');
    await this.access.assertChildAccess(user, row.childId);
    return this.presentAssessment(row);
  }

  async createAssessment(dto: CreateAssessmentDto, user: RequestUser) {
    await this.access.assertChildAccess(user, dto.childId);
    const specialistId = await this.resolveSpecialist(dto.specialistId, user);
    await this.assertSpecialistChild(specialistId, dto.childId);
    const assessedAt = dto.assessedAt ? this.requireNotFuture(dto.assessedAt, 'Assessment date') : new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.assessment.create({ data: { ...dto, specialistId, assessedAt }, include: assessmentRelations });
      await this.notifyParents(dto.childId, 'ASSESSMENT', 'New assessment available', 'A specialist added an assessment update.', row.id, tx);
      return row;
    });
    return this.presentAssessment(result);
  }

  async updateAssessment(id: string, dto: UpdateAssessmentDto, user: RequestUser) {
    const row = await this.prisma.assessment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Assessment not found');
    await this.assertSpecialistOwner(row.specialistId, user);
    const updated = await this.prisma.assessment.update({ where: { id }, data: dto, include: assessmentRelations });
    return this.presentAssessment(updated);
  }

  async progress(childId: string, user: RequestUser) {
    await this.access.assertChildAccess(user, childId);
    const rows = await this.prisma.progressEntry.findMany({
      where: { childId }, include: progressRelations, orderBy: { occurredAt: 'desc' },
    });
    return rows.map((row) => this.presentProgress(row));
  }

  async listProgress(query: ClinicalListQueryDto, user: RequestUser) {
    const where = await this.progressWhere(query, user);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.progressEntry.findMany({
        where,
        include: progressRelations,
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.progressEntry.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.presentProgress(row)),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async progressById(id: string, user: RequestUser) {
    const row = await this.prisma.progressEntry.findUnique({ where: { id }, include: progressRelations });
    if (!row) throw new NotFoundException('Progress entry not found');
    await this.access.assertChildAccess(user, row.childId);
    return this.presentProgress(row);
  }

  async createProgress(dto: CreateProgressDto, user: RequestUser) {
    await this.access.assertChildAccess(user, dto.childId);
    const specialistId = await this.resolveSpecialist(dto.specialistId, user);
    await this.assertSpecialistChild(specialistId, dto.childId);
    const occurredAt = dto.occurredAt ? this.requireNotFuture(dto.occurredAt, 'Progress date') : new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.progressEntry.create({
        data: { ...dto, specialistId, occurredAt, createdById: user.id },
        include: progressRelations,
      });
      await this.notifyParents(dto.childId, 'PROGRESS', 'New progress update', 'A specialist added a progress update.', row.id, tx);
      return row;
    });
    return this.presentProgress(result);
  }

  async updateProgress(id: string, dto: UpdateProgressDto, user: RequestUser) {
    const row = await this.prisma.progressEntry.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Progress entry not found');
    await this.assertSpecialistOwner(row.specialistId, user);
    const occurredAt = dto.occurredAt ? this.requireNotFuture(dto.occurredAt, 'Progress date') : undefined;
    const updated = await this.prisma.progressEntry.update({
      where: { id }, data: { ...dto, occurredAt }, include: progressRelations,
    });
    return this.presentProgress(updated);
  }

  private async assessmentWhere(query: ClinicalListQueryDto, user: RequestUser): Promise<Prisma.AssessmentWhereInput> {
    const access = await this.clinicalAccessWhere(user, query.specialistId);
    return { ...access, childId: query.childId, assessedAt: this.dateRange(query.from, query.to) };
  }

  private async progressWhere(query: ClinicalListQueryDto, user: RequestUser): Promise<Prisma.ProgressEntryWhereInput> {
    const access = await this.clinicalAccessWhere(user, query.specialistId);
    return { ...access, childId: query.childId, occurredAt: this.dateRange(query.from, query.to) };
  }

  private async clinicalAccessWhere(
    user: RequestUser,
    requestedSpecialistId?: string,
  ): Promise<{ specialistId?: string; child?: Prisma.ChildWhereInput }> {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return { specialistId: requestedSpecialistId };
    if (user.role === Role.SPECIALIST) {
      const specialistId = await this.access.currentSpecialistId(user.id);
      if (requestedSpecialistId && requestedSpecialistId !== specialistId) {
        throw new ForbiddenException('Specialists may only view their own clinical records');
      }
      return { specialistId };
    }
    if (user.role === Role.PARENT) {
      return {
        specialistId: requestedSpecialistId,
        child: { parents: { some: { parent: { userId: user.id } } } },
      };
    }
    throw new ForbiddenException('Access denied');
  }

  private dateRange(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
    if (!from && !to) return undefined;
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      if (!to.includes('T')) end.setUTCHours(23, 59, 59, 999);
      range.lte = end;
    }
    if (range.gte && range.lte && range.gte > range.lte) throw new BadRequestException('from must be before or equal to to');
    return range;
  }

  private requireNotFuture(value: string, label: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} is invalid`);
    if (date.getTime() > Date.now()) throw new BadRequestException(`${label} cannot be in the future`);
    return date;
  }

  private presentAssessment<T extends ClinicalRelations & { assessedAt: Date }>(row: T) {
    if (!row.child || !row.specialist?.user) {
      throw new InternalServerErrorException('Assessment relation integrity violation');
    }
    return {
      ...row,
      assessmentDate: row.assessedAt,
      child: { ...row.child, fullName: `${row.child.firstName} ${row.child.lastName}`.trim() },
      specialist: { ...row.specialist, fullName: row.specialist.user.fullName },
    };
  }

  private presentProgress<T extends ProgressRelations & { occurredAt: Date }>(row: T) {
    if (!row.child || !row.specialist?.user) {
      throw new InternalServerErrorException('Progress relation integrity violation');
    }
    return {
      ...row,
      progressDate: row.occurredAt,
      child: { ...row.child, fullName: `${row.child.firstName} ${row.child.lastName}`.trim() },
      specialist: { ...row.specialist, fullName: row.specialist.user.fullName },
      recordedBy: row.createdBy,
    };
  }

  private async resolveSpecialist(requestedId: string | undefined, user: RequestUser): Promise<string> {
    if (user.role === Role.SPECIALIST) return this.access.currentSpecialistId(user.id);
    if ((user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) && requestedId) return requestedId;
    throw new ForbiddenException('A specialist profile is required');
  }

  private async assertSpecialistChild(specialistId: string, childId: string): Promise<void> {
    const [specialist, child] = await Promise.all([
      this.prisma.specialist.findUnique({ where: { id: specialistId }, select: { status: true } }),
      this.prisma.child.findUnique({ where: { id: childId }, select: { id: true } }),
    ]);
    if (!specialist || specialist.status !== 'ACTIVE') throw new ForbiddenException('Specialist must be active');
    if (!child) throw new NotFoundException('Child not found');
  }

  private async assertSpecialistOwner(specialistId: string, user: RequestUser): Promise<void> {
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) return;
    const mine = await this.access.currentSpecialistId(user.id);
    if (mine !== specialistId) throw new ForbiddenException('Only the assigned specialist may change this record');
  }

  private async notifyParents(
    childId: string,
    type: 'ASSESSMENT' | 'PROGRESS',
    title: string,
    message: string,
    entityId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const parents = await tx.childParent.findMany({ where: { childId }, select: { parent: { select: { userId: true } } } });
    await Promise.all(parents.map(({ parent }) => this.notifications.create({
      userId: parent.userId,
      type,
      title,
      message,
      relatedEntity: type === 'ASSESSMENT' ? 'Assessment' : 'ProgressEntry',
      relatedEntityId: entityId,
      dedupeKey: `${type.toLowerCase()}:${entityId}:${parent.userId}`,
      allowSms: false,
    }, tx)));
  }
}
