import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChildStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../../common/services/access.service';
import { RequestUser } from '../../common/types/request-user.type';
import { CreateChildDto, ChildQueryDto, LinkParentDto, UpdateChildDto } from './dto/children.dto';

@Injectable()
export class ChildrenService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}
  async create(dto: CreateChildDto, actorId: string) {
    const child = await this.prisma.child.create({ data: { ...dto, birthDate: new Date(dto.birthDate) } });
    await this.log(actorId, 'CHILD_CREATED', child.id, 'Created child profile'); return child;
  }
  async list(query: ChildQueryDto, user: RequestUser) {
    const where: Prisma.ChildWhereInput = { status: query.status, ...(query.search ? { OR: [{ firstName: { contains: query.search.trim(), mode: 'insensitive' } }, { lastName: { contains: query.search.trim(), mode: 'insensitive' } }] } : {}) };
    if (user.role === Role.PARENT) where.parents = { some: { parent: { userId: user.id } } };
    if (user.role === Role.SPECIALIST) {
      const specialistFilter = {
        OR: [
          { attendances: { some: { specialist: { userId: user.id } } } },
          { assessments: { some: { specialist: { userId: user.id } } } },
          { goals: { some: { specialist: { userId: user.id } } } },
          { progressEntries: { some: { specialist: { userId: user.id } } } },
        ],
      };
      where.AND = [specialistFilter];
    }
    const [items, total] = await this.prisma.$transaction([this.prisma.child.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { createdAt: 'desc' }, include: { parents: { include: { parent: { include: { user: { select: { fullName: true, phone: true } } } } } } } }), this.prisma.child.count({ where })]);
    return { items, meta: { page: query.page, limit: query.limit, total } };
  }
  async get(id: string, user: RequestUser) { await this.access.assertChildAccess(user, id); const child = await this.prisma.child.findUnique({ where: { id }, include: { parents: { include: { parent: { include: { user: { select: { id: true, fullName: true, phone: true } } } } } } } }); if (!child) throw new NotFoundException('Child not found'); return child; }
  async update(id: string, dto: UpdateChildDto, actorId: string) { await this.requireChild(id); const item = await this.prisma.child.update({ where: { id }, data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined } }); await this.log(actorId, 'CHILD_UPDATED', id, 'Updated child profile'); return item; }
  async archive(id: string, actorId: string) { await this.requireChild(id); const item = await this.prisma.child.update({ where: { id }, data: { status: ChildStatus.ARCHIVED } }); await this.log(actorId, 'CHILD_ARCHIVED', id, 'Archived child'); return item; }
  async restore(id: string, actorId: string) { await this.requireChild(id); const item = await this.prisma.child.update({ where: { id }, data: { status: ChildStatus.ACTIVE } }); await this.log(actorId, 'CHILD_RESTORED', id, 'Restored child'); return item; }
  async parents(childId: string, user: RequestUser) { await this.access.assertChildAccess(user, childId); return this.prisma.childParent.findMany({ where: { childId }, include: { parent: { include: { user: { select: { id: true, fullName: true, phone: true } } } } } }); }
  async linkParent(childId: string, parentId: string, dto: LinkParentDto, actorId: string) {
    await this.requireChild(childId); const parent = await this.prisma.parent.findUnique({ where: { id: parentId }, select: { id: true } }); if (!parent) throw new NotFoundException('Parent not found');
    try { const relation = await this.prisma.$transaction(async (tx) => { if (dto.isPrimary) await tx.childParent.updateMany({ where: { childId }, data: { isPrimary: false } }); return tx.childParent.create({ data: { childId, parentId, relationship: dto.relationship, isPrimary: dto.isPrimary ?? false } }); }); await this.log(actorId, 'CHILD_PARENT_LINKED', childId, 'Linked parent to child'); return relation; } catch (error) { if (this.isUnique(error)) throw new ConflictException('Parent is already linked to this child'); throw error; }
  }
  async updateLink(childId: string, parentId: string, dto: LinkParentDto, actorId: string) { const relation = await this.prisma.$transaction(async (tx) => { const existing = await tx.childParent.findUnique({ where: { childId_parentId: { childId, parentId } } }); if (!existing) throw new NotFoundException('Parent-child relationship not found'); if (dto.isPrimary) await tx.childParent.updateMany({ where: { childId, id: { not: existing.id } }, data: { isPrimary: false } }); return tx.childParent.update({ where: { id: existing.id }, data: dto }); }); await this.log(actorId, 'CHILD_PARENT_UPDATED', childId, 'Updated parent-child relationship'); return relation; }
  async unlinkParent(childId: string, parentId: string, actorId: string): Promise<void> { const relation = await this.prisma.childParent.findUnique({ where: { childId_parentId: { childId, parentId } } }); if (!relation) throw new NotFoundException('Parent-child relationship not found'); const otherRelations = await this.prisma.childParent.count({ where: { childId } }); if (relation.isPrimary && otherRelations > 1) throw new ForbiddenException('Assign another primary guardian before removing this one'); await this.prisma.childParent.delete({ where: { id: relation.id } }); await this.log(actorId, 'CHILD_PARENT_UNLINKED', childId, 'Unlinked parent from child'); }
  private async requireChild(id: string): Promise<void> { if (!await this.prisma.child.findUnique({ where: { id }, select: { id: true } })) throw new NotFoundException('Child not found'); }
  private async log(userId: string, action: string, entityId: string, description: string): Promise<void> { await this.prisma.activityLog.create({ data: { userId, action, entity: 'Child', entityId, description } }); }
  private isUnique(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
