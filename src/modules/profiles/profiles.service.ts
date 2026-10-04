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
    let phone: string;
    try {
      phone = normalizeUzbekPhone(dto.phone);
    } catch {
      throw new ConflictException('Invalid phone number');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone,
            role: Role.PARENT,
            passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
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
            email: true,
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
            email: user.email,
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
      throw new ConflictException('Invalid phone number');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone,
            role: Role.SPECIALIST,
            passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
            specialist: {
              create: {
                specialization: dto.specialization,
                experienceYears: dto.experienceYears,
                bio: dto.bio,
              },
            },
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            specialist: {
              select: {
                id: true,
                specialization: true,
                experienceYears: true,
                bio: true,
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
          status: user.specialist!.status,
          createdAt: user.specialist!.createdAt,
          updatedAt: user.specialist!.updatedAt,
          user: {
            id: user.id,
            fullName: user.fullName,
            phone: user.phone,
            email: user.email,
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
    const [items, total] = await this.prisma.$transaction([
      this.prisma.parent.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true } },
          _count: { select: { children: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.parent.count(),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async listSpecialists(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.specialist.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.specialist.count(),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async getParent(id: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true } },
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
        user: { select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true } },
      },
    });
    if (!specialist) throw new NotFoundException('Specialist not found');
    return specialist;
  }

  async updateParent(id: string, dto: UpdateParentDto, actorId: string) {
    await this.getParent(id);
    const parent = await this.prisma.parent.update({
      where: { id },
      data: {
        address: dto.address,
        user: dto.fullName ? { update: { fullName: dto.fullName } } : undefined,
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
      },
    });
    await this.log(actorId, 'PARENT_UPDATED', 'Parent', id, 'Updated parent profile');
    return parent;
  }

  async updateSpecialist(id: string, dto: UpdateSpecialistDto, actorId: string) {
    await this.getSpecialist(id);
    const item = await this.prisma.specialist.update({
      where: { id },
      data: dto,
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
      },
    });
    await this.log(actorId, 'SPECIALIST_UPDATED', 'Specialist', id, 'Updated specialist profile');
    return item;
  }

  async archiveSpecialist(id: string, actorId: string) {
    await this.getSpecialist(id);
    const item = await this.prisma.specialist.update({
      where: { id },
      data: { status: SpecialistStatus.ARCHIVED },
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
      },
    });
    await this.log(actorId, 'SPECIALIST_ARCHIVED', 'Specialist', id, 'Archived specialist');
    return item;
  }

  async parentForUser(userId: string) {
    const parent = await this.prisma.parent.findUnique({
      where: { userId },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
    });
    if (!parent) throw new NotFoundException('Parent profile not found');
    return parent;
  }

  async specialistForUser(userId: string) {
    const specialist = await this.prisma.specialist.findUnique({
      where: { userId },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
    });
    if (!specialist) throw new NotFoundException('Specialist profile not found');
    return specialist;
  }

  private async log(userId: string, action: string, entity: string, entityId: string, description: string): Promise<void> {
    await this.prisma.activityLog.create({ data: { userId, action, entity, entityId, description } });
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
