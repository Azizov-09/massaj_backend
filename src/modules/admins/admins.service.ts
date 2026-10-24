import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { normalizeUzbekPhone } from '../../common/utils/phone.util';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin.dto';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAdminDto, actorId: string) {
    let phone: string;
    try {
      phone = normalizeUzbekPhone(dto.phone);
    } catch {
      throw new BadRequestException({ field: 'phone', message: 'Phone must be a valid Uzbekistan phone number' });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone,
            role: dto.role,
            passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
            admin: { create: {} },
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
            admin: { select: { id: true } },
          },
        });

        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'ADMIN_CREATED',
            entity: 'User',
            entityId: user.id,
            description: `Created admin account for ${user.fullName} (${dto.role})`,
          },
        });

        return user;
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Phone number is already registered');
      }
      throw error;
    }
  }

  async findAll(params: {
    page: number;
    limit: number;
    role?: Role;
    status?: UserStatus;
    search?: string;
  }) {
    const { page, limit, role, status, search } = params;
    const where = {
      role: role ?? { in: [Role.SUPER_ADMIN, Role.ADMIN] },
      ...(status ? { status } : { status: { not: UserStatus.ARCHIVED } }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          admin: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
        admin: { select: { id: true } },
      },
    });
    if (!user) throw new NotFoundException('Admin not found');
    return user;
  }

  async update(id: string, dto: UpdateAdminDto, actorId: string) {
    const current = await this.findOne(id);

    let phone: string | undefined;
    if (dto.phone) {
      try {
        phone = normalizeUzbekPhone(dto.phone);
      } catch {
        throw new BadRequestException({ field: 'phone', message: 'Phone must be a valid Uzbekistan phone number' });
      }
    }

    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    }

    let statusVal: UserStatus | undefined;
    if (dto.status) {
      if (dto.status === 'ACTIVE') statusVal = UserStatus.ACTIVE;
      else if (dto.status === 'INACTIVE') statusVal = UserStatus.INACTIVE;
      else if (dto.status === 'ARCHIVED') statusVal = UserStatus.ARCHIVED;
      else if (dto.status === 'BLOCKED') statusVal = UserStatus.BLOCKED;
    }

    if (id === actorId && ((dto.role && dto.role !== Role.SUPER_ADMIN) || (statusVal && statusVal !== UserStatus.ACTIVE))) {
      throw new ForbiddenException('You cannot remove your own SUPER_ADMIN access');
    }

    const removesSuperAdmin =
      current.role === Role.SUPER_ADMIN &&
      ((dto.role !== undefined && dto.role !== Role.SUPER_ADMIN) ||
        (statusVal !== undefined && statusVal !== UserStatus.ACTIVE));
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (removesSuperAdmin) {
          const activeSuperAdmins = await tx.user.count({
            where: { role: Role.SUPER_ADMIN, status: UserStatus.ACTIVE },
          });
          if (activeSuperAdmins <= 1) {
            throw new ForbiddenException('The last active SUPER_ADMIN cannot be demoted or disabled');
          }
        }
        const securityChanged = Boolean(dto.role || statusVal || passwordHash);
        const updated = await tx.user.update({
          where: { id },
          data: {
            ...(dto.fullName && { fullName: dto.fullName }),
            ...(phone && { phone }),
            ...(dto.role && { role: dto.role }),
            ...(statusVal && { status: statusVal }),
            ...(passwordHash && { passwordHash, passwordChangedAt: new Date() }),
            ...(securityChanged && { tokenVersion: { increment: 1 } }),
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            role: true,
            status: true,
            updatedAt: true,
          },
        });
        if (securityChanged) {
          await tx.userSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'ADMIN_UPDATED',
            entity: 'User',
            entityId: id,
            description: `Updated admin profile: ${updated.fullName} (${updated.role})`,
          },
        });
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        throw new ConflictException('Phone number is already registered');
      }
      throw err;
    }
  }

  async archive(id: string, actorId: string) {
    return this.transitionStatus(id, UserStatus.ARCHIVED, actorId, 'ADMIN_ARCHIVED');
  }

  async activate(id: string, actorId: string) {
    return this.transitionStatus(id, UserStatus.ACTIVE, actorId, 'ADMIN_ACTIVATED');
  }

  async deactivate(id: string, actorId: string) {
    return this.transitionStatus(id, UserStatus.INACTIVE, actorId, 'ADMIN_DEACTIVATED');
  }

  async restore(id: string, actorId: string) {
    const admin = await this.findOne(id);
    if (admin.status !== UserStatus.ARCHIVED) {
      throw new ConflictException('Only an archived admin can be restored');
    }
    return this.transitionStatus(id, UserStatus.ACTIVE, actorId, 'ADMIN_RESTORED');
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  private async transitionStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
    actorId: string,
    action: string,
  ) {
    const admin = await this.findOne(id);
    if (id === actorId && status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('You cannot deactivate or archive your own account');
    }
    if (admin.status === UserStatus.ARCHIVED && action !== 'ADMIN_RESTORED') {
      throw new ConflictException('Archived admin must be restored before changing status');
    }
    return this.prisma.$transaction(async (tx) => {
      if (admin.role === Role.SUPER_ADMIN && status !== UserStatus.ACTIVE) {
        const activeSuperAdmins = await tx.user.count({
          where: { role: Role.SUPER_ADMIN, status: UserStatus.ACTIVE },
        });
        if (activeSuperAdmins <= 1) {
          throw new ForbiddenException('The last active SUPER_ADMIN cannot be disabled or archived');
        }
      }
      const updated = await tx.user.update({
        where: { id },
        data: { status, tokenVersion: { increment: 1 } },
        select: { id: true, fullName: true, phone: true, role: true, status: true, updatedAt: true },
      });
      await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.activityLog.create({
        data: {
          userId: actorId,
          action,
          entity: 'User',
          entityId: id,
          description: `Changed admin status from ${admin.status} to ${status} and revoked active sessions`,
          metadata: { from: admin.status, to: status },
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
