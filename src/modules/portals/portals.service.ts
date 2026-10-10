import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FinanceService } from '../finance/finance.service';
@Injectable()
export class PortalsService {
  constructor(private readonly prisma: PrismaService, private readonly finance: FinanceService) {}
  async parentId(userId: string): Promise<string> { const parent = await this.prisma.parent.findUnique({ where: { userId }, select: { id: true } }); if (!parent) throw new NotFoundException('Parent profile not found'); return parent.id; }
  async specialistId(userId: string): Promise<string> { const specialist = await this.prisma.specialist.findUnique({ where: { userId }, select: { id: true } }); if (!specialist) throw new NotFoundException('Specialist profile not found'); return specialist.id; }
  async parentChildren(userId: string) { return this.prisma.childParent.findMany({ where: { parent: { userId } }, include: { child: true }, orderBy: { child: { createdAt: 'desc' } } }); }
  parentAssessments(userId: string) { return this.prisma.assessment.findMany({ where: { child: { parents: { some: { parent: { userId } } } } }, include: { child: true, specialist: { include: { user: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  parentAttendances(userId: string) { return this.prisma.attendance.findMany({ where: { child: { parents: { some: { parent: { userId } } } } }, include: { child: true, specialist: { include: { user: { select: { fullName: true } } } } }, orderBy: { date: 'desc' } }); }
  parentProgress(userId: string) { return this.prisma.progressEntry.findMany({ where: { child: { parents: { some: { parent: { userId } } } } }, include: { child: true, specialist: { include: { user: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  parentGoals(userId: string) { return this.prisma.goal.findMany({ where: { child: { parents: { some: { parent: { userId } } } } }, include: { child: true, specialist: { include: { user: { select: { fullName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  async parentPayments(userId: string) { return this.prisma.payment.findMany({ where: { parent: { userId } }, orderBy: { paidAt: 'desc' } }); }
  async parentState(userId: string) { return this.finance.stateForParent(await this.parentId(userId)); }
  async specialistChildren(userId: string) {
    const id = await this.specialistId(userId);
    return this.prisma.child.findMany({
      where: {
        OR: [
          { attendances: { some: { specialistId: id } } },
          { assessments: { some: { specialistId: id } } },
          { goals: { some: { specialistId: id } } },
          { progressEntries: { some: { specialistId: id } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async specialistAttendances(userId: string) {
    const id = await this.specialistId(userId);
    return this.prisma.attendance.findMany({
      where: { specialistId: id },
      include: { child: true },
      orderBy: { date: 'desc' },
    });
  }
  async specialistAssessments(userId: string) { const id = await this.specialistId(userId); return this.prisma.assessment.findMany({ where: { specialistId: id }, include: { child: true }, orderBy: { createdAt: 'desc' } }); }
  async specialistProgress(userId: string) { const id = await this.specialistId(userId); return this.prisma.progressEntry.findMany({ where: { specialistId: id }, include: { child: true }, orderBy: { createdAt: 'desc' } }); }
  async specialistGoals(userId: string) { const id = await this.specialistId(userId); return this.prisma.goal.findMany({ where: { specialistId: id }, include: { child: true }, orderBy: { createdAt: 'desc' } }); }
}
