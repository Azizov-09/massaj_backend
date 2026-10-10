import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RequestUser } from '../types/request-user.type';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}
  async assertChildAccess(user: RequestUser, childId: string): Promise<void> {
    const child = await this.prisma.child.findUnique({ where: { id: childId }, select: { id: true } });
    if (!child) throw new NotFoundException('Child not found');
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return;
    if (user.role === Role.PARENT) {
      const relation = await this.prisma.childParent.findFirst({ where: { childId, parent: { userId: user.id } }, select: { id: true } });
      if (relation) return;
    }
    if (user.role === Role.SPECIALIST) {
      const specialist = await this.prisma.specialist.findUnique({ where: { userId: user.id }, select: { id: true, status: true } });
      if (specialist && specialist.status === 'ACTIVE') return;
    }
    throw new ForbiddenException('You do not have access to this child');
  }
  async assertParentOwnsChild(parentId: string, childId: string): Promise<void> {
    const relation = await this.prisma.childParent.findUnique({ where: { childId_parentId: { childId, parentId } }, select: { id: true } });
    if (!relation) throw new ForbiddenException('Parent is not related to the child');
  }
  async currentParentId(userId: string): Promise<string> {
    const parent = await this.prisma.parent.findUnique({ where: { userId }, select: { id: true } });
    if (!parent) throw new ForbiddenException('Parent profile is required'); return parent.id;
  }
  async currentSpecialistId(userId: string): Promise<string> {
    const specialist = await this.prisma.specialist.findUnique({ where: { userId }, select: { id: true, status: true } });
    if (!specialist || specialist.status !== 'ACTIVE') throw new ForbiddenException('An active specialist profile is required'); return specialist.id;
  }
}
