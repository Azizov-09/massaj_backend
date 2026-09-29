import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma, Role, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RequestUser } from '../../common/types/request-user.type';
import { FinanceService } from '../finance/finance.service';
import { CancelSessionDto, CompleteSessionDto, SessionQueryDto } from './dto/sessions.dto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService, private readonly finance: FinanceService) {}
  async list(query: SessionQueryDto, user: RequestUser) { const where: Prisma.SessionWhereInput = { childId: query.childId }; if (user.role === Role.PARENT) where.appointment = { parent: { userId: user.id } }; if (user.role === Role.SPECIALIST) where.specialist = { userId: user.id }; const [items, total] = await this.prisma.$transaction([this.prisma.session.findMany({ where, include: { child: true, service: true, appointment: true }, orderBy: { startedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), this.prisma.session.count({ where })]); return { items, meta: { page: query.page, limit: query.limit, total } }; }
  async get(id: string, user: RequestUser) { const session = await this.prisma.session.findUnique({ where: { id }, include: { child: true, service: true, appointment: { include: { parent: { include: { user: { select: { fullName: true } } } } } } } }); if (!session) throw new NotFoundException('Session not found'); await this.assertAccess(session.id, user); return session; }
  async complete(id: string, dto: CompleteSessionDto, user: RequestUser) {
    await this.assertAccess(id, user, true);
    try { return await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({ where: { id }, include: { appointment: { include: { parent: { select: { userId: true } } } } } }); if (!session) throw new NotFoundException('Session not found');
      if (session.status !== SessionStatus.IN_PROGRESS) throw new BadRequestException('Only an in-progress session can be completed');
      const completed = await tx.session.update({ where: { id }, data: { status: SessionStatus.COMPLETED, completedAt: new Date(), ...dto } });
      await tx.appointment.update({ where: { id: session.appointmentId }, data: { status: AppointmentStatus.COMPLETED } });
      await this.finance.chargeCompletedSession({ sessionId: session.id, appointmentId: session.appointmentId, parentId: session.appointment.parentId, parentUserId: session.appointment.parent.userId, childId: session.childId, amount: session.servicePriceSnapshot }, user.id, tx);
      return completed;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { if (this.isUnique(error)) throw new ConflictException('Session charge already exists'); throw error; }
  }
  async cancel(id: string, dto: CancelSessionDto, user: RequestUser) { await this.assertAccess(id, user, true); const result = await this.prisma.$transaction(async (tx) => { const session = await tx.session.findUnique({ where: { id } }); if (!session) throw new NotFoundException('Session not found'); if (session.status !== SessionStatus.IN_PROGRESS) throw new BadRequestException('Only an in-progress session can be cancelled'); const cancelled = await tx.session.update({ where: { id }, data: { status: SessionStatus.CANCELLED, note: dto.note } }); await tx.appointment.update({ where: { id: session.appointmentId }, data: { status: AppointmentStatus.CANCELLED } }); await tx.activityLog.create({ data: { userId: user.id, action: 'SESSION_CANCELLED', entity: 'Session', entityId: id, description: 'Cancelled in-progress session' } }); return cancelled; }); return result; }
  private async assertAccess(id: string, user: RequestUser, write = false) { const session = await this.prisma.session.findUnique({ where: { id }, select: { appointment: { select: { parent: { select: { userId: true } } } }, specialist: { select: { userId: true } } } }); if (!session) throw new NotFoundException('Session not found'); if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return; if (!write && user.role === Role.PARENT && session.appointment.parent.userId === user.id) return; if (user.role === Role.SPECIALIST && session.specialist.userId === user.id) return; throw new ForbiddenException('You do not have access to this session'); }
  private isUnique(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
