import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../../common/services/access.service';
import { RequestUser } from '../../common/types/request-user.type';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAssessmentDto, CreateAttendanceDto, CreateGoalDto, CreateProgressDto, UpdateAssessmentDto, UpdateAttendanceDto, UpdateGoalDto, UpdateProgressDto } from './dto/clinical.dto';

@Injectable()
export class ClinicalService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService, private readonly notifications: NotificationsService) {}
  async attendance(dto: CreateAttendanceDto, user: RequestUser) {
    await this.access.assertChildAccess(user, dto.childId);
    let specialistId: string | undefined = undefined;
    if (user.role === Role.SPECIALIST) {
      specialistId = await this.access.currentSpecialistId(user.id);
    } else if (dto.specialistId) {
      specialistId = dto.specialistId;
    }
    return this.prisma.attendance.create({
      data: {
        childId: dto.childId,
        specialistId,
        status: dto.status,
        note: dto.note,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });
  }
  async updateAttendance(id: string, dto: UpdateAttendanceDto, user: RequestUser) {
    const row = await this.prisma.attendance.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attendance not found');
    if (row.specialistId) {
      await this.assertSpecialistOwner(row.specialistId, user);
    } else if (user.role === Role.SPECIALIST) {
      throw new ForbiddenException('Only administrators or assigned specialists can update attendance');
    }
    return this.prisma.attendance.update({ where: { id }, data: dto });
  }
  async attendances(childId: string, user: RequestUser) {
    await this.access.assertChildAccess(user, childId);
    return this.prisma.attendance.findMany({
      where: { childId },
      include: {
        specialist: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { date: 'desc' },
    });
  }
  async assessments(childId: string, user: RequestUser) { await this.access.assertChildAccess(user, childId); return this.prisma.assessment.findMany({ where: { childId }, include: { specialist: { include: { user: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  async createAssessment(dto: CreateAssessmentDto, user: RequestUser) {
    await this.access.assertChildAccess(user, dto.childId);
    const specialistId = await this.resolveSpecialist(dto.specialistId, user);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.assessment.create({ data: { ...dto, specialistId } });
      await this.notifyParents(dto.childId, 'ASSESSMENT', 'New assessment available', 'A specialist added an assessment update.', row.id, tx);
      return row;
    });
  }
  async updateAssessment(id: string, dto: UpdateAssessmentDto, user: RequestUser) { const row = await this.prisma.assessment.findUnique({ where: { id } }); if (!row) throw new NotFoundException('Assessment not found'); await this.assertSpecialistOwner(row.specialistId, user); return this.prisma.assessment.update({ where: { id }, data: dto }); }
  async progress(childId: string, user: RequestUser) { await this.access.assertChildAccess(user, childId); return this.prisma.progressEntry.findMany({ where: { childId }, include: { specialist: { include: { user: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  async createProgress(dto: CreateProgressDto, user: RequestUser) {
    await this.access.assertChildAccess(user, dto.childId);
    const specialistId = await this.resolveSpecialist(dto.specialistId, user);
    await this.assertSpecialistChild(specialistId, dto.childId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.progressEntry.create({ data: { ...dto, specialistId } });
      await this.notifyParents(dto.childId, 'PROGRESS', 'New progress update', 'A specialist added a progress update.', row.id, tx);
      return row;
    });
  }
  async updateProgress(id: string, dto: UpdateProgressDto, user: RequestUser) { const row = await this.prisma.progressEntry.findUnique({ where: { id } }); if (!row) throw new NotFoundException('Progress entry not found'); await this.assertSpecialistOwner(row.specialistId, user); return this.prisma.progressEntry.update({ where: { id }, data: dto }); }
  async goals(childId: string, user: RequestUser) { await this.access.assertChildAccess(user, childId); return this.prisma.goal.findMany({ where: { childId }, include: { specialist: { include: { user: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  async createGoal(dto: CreateGoalDto, user: RequestUser) {
    await this.access.assertChildAccess(user, dto.childId);
    const specialistId = await this.resolveSpecialist(dto.specialistId, user);
    await this.assertSpecialistChild(specialistId, dto.childId);
    return this.prisma.goal.create({ data: { ...dto, specialistId, targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined } });
  }
  async updateGoal(id: string, dto: UpdateGoalDto, user: RequestUser) { const row = await this.prisma.goal.findUnique({ where: { id } }); if (!row) throw new NotFoundException('Goal not found'); await this.assertSpecialistOwner(row.specialistId, user); return this.prisma.goal.update({ where: { id }, data: { ...dto, targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined } }); }
  async completeGoal(id: string, user: RequestUser) { return this.updateGoal(id, { status: GoalStatus.COMPLETED, progress: 100 }, user); }
  async pauseGoal(id: string, user: RequestUser) { return this.updateGoal(id, { status: GoalStatus.PAUSED }, user); }
  private async resolveSpecialist(requestedId: string | undefined, user: RequestUser): Promise<string> { if (user.role === Role.SPECIALIST) return this.access.currentSpecialistId(user.id); if ((user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) && requestedId) return requestedId; throw new ForbiddenException('A specialist profile is required'); }
  private async assertSpecialistChild(specialistId: string, childId: string): Promise<void> {
    const specialist = await this.prisma.specialist.findUnique({ where: { id: specialistId }, select: { status: true } });
    if (!specialist || specialist.status !== 'ACTIVE') throw new ForbiddenException('Specialist must be active');
    const child = await this.prisma.child.findUnique({ where: { id: childId }, select: { id: true } });
    if (!child) throw new NotFoundException('Child not found');
  }
  private async assertSpecialistOwner(specialistId: string, user: RequestUser): Promise<void> { if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) return; const mine = await this.access.currentSpecialistId(user.id); if (mine !== specialistId) throw new ForbiddenException('Only the assigned specialist may change this record'); }
  private async notifyParents(childId: string, type: 'ASSESSMENT' | 'PROGRESS', title: string, message: string, entityId: string, tx: Prisma.TransactionClient) { const parents = await tx.childParent.findMany({ where: { childId }, select: { parent: { select: { userId: true } } } }); await Promise.all(parents.map(({ parent }) => this.notifications.create({ userId: parent.userId, type, title, message, relatedEntity: type === 'ASSESSMENT' ? 'Assessment' : 'ProgressEntry', relatedEntityId: entityId, dedupeKey: `${type.toLowerCase()}:${entityId}:${parent.userId}`, allowSms: false }, tx))); }
  private isUnique(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
