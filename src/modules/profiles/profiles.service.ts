import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, SpecialistStatus, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { normalizeUzbekPhone } from '../../common/utils/phone.util';
import { CreateParentDto, CreateSpecialistDto, UpdateParentDto, UpdateSpecialistDto } from './dto/profiles.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createParent(dto: CreateParentDto, actorId: string) {
    let phone: string;
    try {
      phone = normalizeUzbekPhone(dto.phone);
    } catch {
      throw new BadRequestException({ field: 'phone', message: 'Phone must be a valid Uzbekistan phone number' });
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone,
            role: Role.PARENT,
            passwordHash,
            parent: {
              create: {
                address: dto.address,
              },
            },
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
            parent: {
              select: {
                id: true,
                address: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        await tx.notificationPreference.create({ data: { userId: user.id } });
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'PARENT_CREATED',
            entity: 'Parent',
            entityId: user.parent!.id,
            description: `Created parent profile for ${user.fullName}`,
          },
        });

        return {
          id: user.parent!.id,
          userId: user.id,
          address: user.parent!.address,
          createdAt: user.parent!.createdAt,
          updatedAt: user.parent!.updatedAt,
          user: {
            id: user.id,
            fullName: user.fullName,
            phone: user.phone,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
          },
        };
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Phone is already registered');
      throw error;
    }
  }

  async createSpecialist(dto: CreateSpecialistDto, actorId: string) {
    let phone: string;
    try {
      phone = normalizeUzbekPhone(dto.phone);
    } catch {
      throw new BadRequestException({ field: 'phone', message: 'Phone must be a valid Uzbekistan phone number' });
    }
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const workingDays = this.canonicalWorkingDays(dto.workingDays);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone,
            role: Role.SPECIALIST,
            passwordHash,
            specialist: {
              create: {
                specialization: dto.specialization,
                experienceYears: dto.experienceYears,
                bio: dto.bio ?? null,
                workingDays,
              },
            },
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
            specialist: {
              select: {
                id: true,
                specialization: true,
                experienceYears: true,
                bio: true,
                workingDays: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        await tx.notificationPreference.create({ data: { userId: user.id } });
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'SPECIALIST_CREATED',
            entity: 'Specialist',
            entityId: user.specialist!.id,
            description: `Created specialist profile for ${user.fullName}`,
          },
        });

        return {
          id: user.specialist!.id,
          userId: user.id,
          specialization: user.specialist!.specialization,
          experienceYears: user.specialist!.experienceYears,
          bio: user.specialist!.bio,
          workingDays: user.specialist!.workingDays,
          status: user.specialist!.status,
          createdAt: user.specialist!.createdAt,
          updatedAt: user.specialist!.updatedAt,
          user: {
            id: user.id,
            fullName: user.fullName,
            phone: user.phone,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
          },
        };
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Phone is already registered');
      throw error;
    }
  }

  async listParents(page: number, limit: number) {
    const where = { user: { status: { not: UserStatus.ARCHIVED } } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.parent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, phone: true, status: true, createdAt: true } },
          _count: { select: { children: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parent.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listSpecialists(page: number, limit: number) {
    const where = { status: { not: SpecialistStatus.ARCHIVED } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.specialist.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, phone: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.specialist.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async getParent(id: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, phone: true, status: true, createdAt: true } },
        children: { include: { child: true } },
      },
    });
    if (!parent) throw new NotFoundException('Parent not found');
    return parent;
  }

  async getSpecialist(id: string) {
    const specialist = await this.prisma.specialist.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, phone: true, status: true, createdAt: true } },
      },
    });
    if (!specialist) throw new NotFoundException('Specialist not found');
    return specialist;
  }

  async updateParent(id: string, dto: UpdateParentDto, actorId: string) {
    let phone: string | undefined;
    try {
      phone = dto.phone === undefined ? undefined : normalizeUzbekPhone(dto.phone);
    } catch {
      throw new BadRequestException({ field: 'phone', message: 'Phone must be a valid Uzbekistan phone number' });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.parent.findUnique({ where: { id }, select: { userId: true } });
        if (!existing) throw new NotFoundException('Parent not found');
        const parent = await tx.parent.update({
          where: { id },
          data: {
            address: dto.address,
            user:
              dto.fullName !== undefined || phone !== undefined
                ? { update: { fullName: dto.fullName, phone } }
                : undefined,
          },
          include: {
            user: { select: { id: true, fullName: true, phone: true, status: true } },
          },
        });
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'PARENT_UPDATED',
            entity: 'Parent',
            entityId: id,
            description: 'Updated parent profile',
          },
        });
        return parent;
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Phone is already registered');
      throw error;
    }
  }

  async updateParentStatus(id: string, status: 'ACTIVE' | 'INACTIVE', actorId: string) {
    return this.transitionParentStatus(id, status, actorId, 'PARENT_STATUS_CHANGED');
  }

  async archiveParent(id: string, actorId: string) {
    return this.transitionParentStatus(id, UserStatus.ARCHIVED, actorId, 'PARENT_ARCHIVED');
  }

  async restoreParent(id: string, actorId: string) {
    const existing = await this.prisma.parent.findUnique({
      where: { id },
      select: { user: { select: { status: true } } },
    });
    if (!existing) throw new NotFoundException('Parent not found');
    if (existing.user.status !== UserStatus.ARCHIVED) {
      throw new ConflictException('Only an archived parent can be restored');
    }
    return this.transitionParentStatus(id, UserStatus.ACTIVE, actorId, 'PARENT_RESTORED');
  }

  async updateSpecialist(id: string, dto: UpdateSpecialistDto, actorId: string) {
    let phone: string | undefined;
    try {
      phone = dto.phone === undefined ? undefined : normalizeUzbekPhone(dto.phone);
    } catch {
      throw new BadRequestException({ field: 'phone', message: 'Phone must be a valid Uzbekistan phone number' });
    }
    const workingDays = this.canonicalWorkingDays(dto.workingDays);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.specialist.findUnique({ where: { id }, select: { userId: true } });
        if (!existing) throw new NotFoundException('Specialist not found');

        const item = await tx.specialist.update({
          where: { id },
          data: {
            specialization: dto.specialization,
            experienceYears: dto.experienceYears,
            bio: dto.bio,
            workingDays,
            user:
              dto.fullName !== undefined || phone !== undefined
                ? { update: { fullName: dto.fullName, phone } }
                : undefined,
          },
          include: {
            user: { select: { id: true, fullName: true, phone: true, status: true } },
          },
        });
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'SPECIALIST_UPDATED',
            entity: 'Specialist',
            entityId: id,
            description: 'Updated specialist profile',
          },
        });
        return item;
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Phone is already registered');
      throw error;
    }
  }

  async updateSpecialistStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    actorId: string,
  ) {
    return this.transitionSpecialistStatus(id, status, actorId, 'SPECIALIST_STATUS_CHANGED');
  }

  async archiveSpecialist(id: string, actorId: string) {
    return this.transitionSpecialistStatus(id, SpecialistStatus.ARCHIVED, actorId, 'SPECIALIST_ARCHIVED');
  }

  async restoreSpecialist(id: string, actorId: string) {
    const existing = await this.prisma.specialist.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new NotFoundException('Specialist not found');
    if (existing.status !== SpecialistStatus.ARCHIVED) {
      throw new ConflictException('Only an archived specialist can be restored');
    }
    return this.transitionSpecialistStatus(id, SpecialistStatus.ACTIVE, actorId, 'SPECIALIST_RESTORED');
  }

  async parentForUser(userId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      include: { user: { select: { id: true, fullName: true, phone: true, status: true } } },
    });
    if (!parent) throw new NotFoundException('Parent profile not found');
    return parent;
  }

  async specialistForUser(userId: string) {
    const specialist = await this.prisma.specialist.findUnique({
      where: { userId },
      include: { user: { select: { id: true, fullName: true, phone: true, status: true } } },
    });
    if (!specialist) throw new NotFoundException('Specialist profile not found');
    return specialist;
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private canonicalWorkingDays(workingDays: number[] | undefined): number[] | undefined {
    return workingDays === undefined ? undefined : [...workingDays].sort((left, right) => left - right);
  }

  private async transitionSpecialistStatus(
    id: string,
    status: SpecialistStatus,
    actorId: string,
    action: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.specialist.findUnique({
        where: { id },
        select: { status: true, userId: true },
      });
      if (!existing) throw new NotFoundException('Specialist not found');
      if (existing.status === SpecialistStatus.ARCHIVED && action !== 'SPECIALIST_RESTORED') {
        throw new ConflictException('Archived specialist must be restored before changing status');
      }

      const userStatus =
        status === SpecialistStatus.ACTIVE
          ? UserStatus.ACTIVE
          : status === SpecialistStatus.INACTIVE
            ? UserStatus.INACTIVE
            : UserStatus.ARCHIVED;
      const revokedAt = new Date();
      const item = await tx.specialist.update({
        where: { id },
        data: {
          status,
          user: { update: { status: userStatus, tokenVersion: { increment: 1 } } },
        },
        include: {
          user: { select: { id: true, fullName: true, phone: true, status: true } },
        },
      });
      await tx.userSession.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt },
      });
      await tx.activityLog.create({
        data: {
          userId: actorId,
          action,
          entity: 'Specialist',
          entityId: id,
          description: `Changed specialist status from ${existing.status} to ${status}`,
          metadata: { from: existing.status, to: status },
        },
      });
      return item;
    });
  }

  private async transitionParentStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
    actorId: string,
    action: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.parent.findUnique({
        where: { id },
        select: { userId: true, user: { select: { status: true } } },
      });
      if (!existing) throw new NotFoundException('Parent not found');
      if (existing.user.status === UserStatus.ARCHIVED && action !== 'PARENT_RESTORED') {
        throw new ConflictException('Archived parent must be restored before changing status');
      }
      const item = await tx.parent.update({
        where: { id },
        data: {
          user: { update: { status, tokenVersion: { increment: 1 } } },
        },
        include: {
          user: { select: { id: true, fullName: true, phone: true, status: true } },
          _count: { select: { children: true, payments: true, transactions: true } },
        },
      });
      await tx.userSession.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.activityLog.create({
        data: {
          userId: actorId,
          action,
          entity: 'Parent',
          entityId: id,
          description: `Changed parent status from ${existing.user.status} to ${status}`,
          metadata: { from: existing.user.status, to: status },
        },
      });
      return item;
    });
  }
}
