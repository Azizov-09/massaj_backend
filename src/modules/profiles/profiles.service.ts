import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, SpecialistStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { normalizeUzbekPhone } from '../../common/utils/phone.util';
import { CreateParentDto, CreateSpecialistDto, UpdateParentDto, UpdateSpecialistDto } from './dto/profiles.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}
  async createParent(dto: CreateParentDto, actorId: string) {
    return this.createProfile(Role.PARENT, dto, actorId, () => ({ parent: { create: { address: dto.address } } }));
  }
  async createSpecialist(dto: CreateSpecialistDto, actorId: string) {
    return this.createProfile(Role.SPECIALIST, dto, actorId, () => ({ specialist: { create: { specialization: dto.specialization, experienceYears: dto.experienceYears, bio: dto.bio } } }));
  }
  async listParents(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([this.prisma.parent.findMany({ skip: (page - 1) * limit, take: limit, include: { user: { select: { id: true, fullName: true, phone: true, status: true, createdAt: true } }, _count: { select: { children: true } } }, orderBy: { createdAt: 'desc' } }), this.prisma.parent.count()]);
    return { items, meta: { page, limit, total } };
  }
  async listSpecialists(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([this.prisma.specialist.findMany({ skip: (page - 1) * limit, take: limit, include: { user: { select: { id: true, fullName: true, phone: true, status: true } } }, orderBy: { createdAt: 'desc' } }), this.prisma.specialist.count()]);
    return { items, meta: { page, limit, total } };
  }
  async getParent(id: string) { const parent = await this.prisma.parent.findUnique({ where: { id }, include: { user: { select: { id: true, fullName: true, phone: true, status: true } }, children: { include: { child: true } } } }); if (!parent) throw new NotFoundException('Parent not found'); return parent; }
  async getSpecialist(id: string) { const specialist = await this.prisma.specialist.findUnique({ where: { id }, include: { user: { select: { id: true, fullName: true, phone: true, status: true } } } }); if (!specialist) throw new NotFoundException('Specialist not found'); return specialist; }
  async updateParent(id: string, dto: UpdateParentDto, actorId: string) { await this.getParent(id); const parent = await this.prisma.parent.update({ where: { id }, data: { address: dto.address, user: dto.fullName ? { update: { fullName: dto.fullName } } : undefined } }); await this.log(actorId, 'PARENT_UPDATED', 'Parent', id, 'Updated parent profile'); return parent; }
  async updateSpecialist(id: string, dto: UpdateSpecialistDto, actorId: string) { await this.getSpecialist(id); const item = await this.prisma.specialist.update({ where: { id }, data: dto }); await this.log(actorId, 'SPECIALIST_UPDATED', 'Specialist', id, 'Updated specialist profile'); return item; }
  async archiveSpecialist(id: string, actorId: string) { await this.getSpecialist(id); const item = await this.prisma.specialist.update({ where: { id }, data: { status: SpecialistStatus.ARCHIVED } }); await this.log(actorId, 'SPECIALIST_ARCHIVED', 'Specialist', id, 'Archived specialist'); return item; }
  async parentForUser(userId: string) { const parent = await this.prisma.parent.findUnique({ where: { userId }, include: { user: { select: { id: true, fullName: true, phone: true } } } }); if (!parent) throw new NotFoundException('Parent profile not found'); return parent; }
  async specialistForUser(userId: string) { const specialist = await this.prisma.specialist.findUnique({ where: { userId }, include: { user: { select: { id: true, fullName: true, phone: true } } } }); if (!specialist) throw new NotFoundException('Specialist profile not found'); return specialist; }
  private async createProfile(role: Role, dto: CreateParentDto | CreateSpecialistDto, actorId: string, profile: () => object) {
    let phone: string; try { phone = normalizeUzbekPhone(dto.phone); } catch { throw new ConflictException('Invalid phone number'); }
    try { return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { fullName: dto.fullName, phone, role, passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }), ...profile() }, include: { parent: true, specialist: true } });
      await tx.notificationPreference.create({ data: { userId: user.id } });
      await tx.activityLog.create({ data: { userId: actorId, action: `${role}_CREATED`, entity: role, entityId: user.id, description: `Created ${role.toLowerCase()} profile` } }); return user;
    }); } catch (error) { if (this.isUniqueError(error)) throw new ConflictException('Phone is already registered'); throw error; }
  }
  private async log(userId: string, action: string, entity: string, entityId: string, description: string): Promise<void> { await this.prisma.activityLog.create({ data: { userId, action, entity, entityId, description } }); }
  private isUniqueError(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
