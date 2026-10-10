import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
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
      throw new ConflictException('Invalid phone number format');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            phone,
            email: dto.email,
            role: dto.role,
            passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
            admin: { create: {} },
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
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
      ...(status && { status }),
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
          email: true,
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
        email: true,
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
    const existing = await this.findOne(id);

    let phone: string | undefined;
    if (dto.phone) {
      try {
        phone = normalizeUzbekPhone(dto.phone);
      } catch {
        throw new ConflictException('Invalid phone number format');
      }
    }

    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    }

    let statusVal: UserStatus | undefined;
    if (dto.status) {
      if (dto.status === 'ACTIVE') statusVal = UserStatus.ACTIVE;
      else if (dto.status === 'INACTIVE' || dto.status === 'ARCHIVED') statusVal = UserStatus.INACTIVE;
      else if (dto.status === 'BLOCKED') statusVal = UserStatus.BLOCKED;
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          ...(dto.fullName && { fullName: dto.fullName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(phone && { phone }),
          ...(dto.role && { role: dto.role }),
          ...(statusVal && { status: statusVal }),
          ...(passwordHash && {
            passwordHash,
            tokenVersion: { increment: 1 },
            passwordChangedAt: new Date(),
          }),
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          role: true,
          status: true,
          updatedAt: true,
        },
      });

      await this.log(actorId, 'ADMIN_UPDATED', 'User', id, `Updated admin profile: ${updated.fullName} (${updated.role})`);
      return updated;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Phone number or email already in use');
      }
      throw err;
    }
  }

  async archive(id: string, actorId: string) {
    const admin = await this.findOne(id);
    if (id === actorId) {
      throw new ForbiddenException('You cannot archive your own account');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.BLOCKED,
          tokenVersion: { increment: 1 },
        },
        select: { id: true, fullName: true, status: true, updatedAt: true },
      });

      await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.activityLog.create({
        data: {
          userId: actorId,
          action: 'ADMIN_ARCHIVED',
          entity: 'User',
          entityId: id,
          description: `Archived admin: ${admin.fullName} and revoked all active sessions`,
        },
      });

      return u;
    });

    return updated;
  }

  private async log(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    description: string,
  ): Promise<void> {
    await this.prisma.activityLog.create({ data: { userId, action, entity, entityId, description } });
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
