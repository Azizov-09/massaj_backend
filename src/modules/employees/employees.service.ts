import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeStatus } from '@prisma/client';
import { normalizeUzbekPhone } from '../../common/utils/phone.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto, actorId: string) {
    const phone = this.normalizePhone(dto.phone);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            fullName: dto.fullName,
            position: dto.position,
            phone,
            salary: dto.salary ?? null,
            notes: dto.notes,
            joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
          },
        });
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'EMPLOYEE_CREATED',
            entity: 'Employee',
            entityId: employee.id,
            description: `Created employee: ${employee.fullName}`,
          },
        });
        return employee;
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Phone number is already registered');
      throw error;
    }
  }

  async findAll(params: {
    page: number;
    limit: number;
    position?: string;
    status?: EmployeeStatus;
    search?: string;
  }) {
    const { page, limit, position, status, search } = params;

    const where = {
      ...(status ? { status } : { status: { not: EmployeeStatus.ARCHIVED } }),
      ...(position && { position: { contains: position, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { position: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, actorId: string) {
    await this.findOne(id);
    const phone = dto.phone === undefined ? undefined : this.normalizePhone(dto.phone);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.employee.update({
          where: { id },
          data: {
            ...(dto.fullName && { fullName: dto.fullName }),
            ...(dto.position && { position: dto.position }),
            ...(phone && { phone }),
            ...(dto.status && { status: dto.status }),
            ...(dto.salary !== undefined && { salary: dto.salary }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
          },
        });
        await tx.activityLog.create({
          data: {
            userId: actorId,
            action: 'EMPLOYEE_UPDATED',
            entity: 'Employee',
            entityId: id,
            description: `Updated employee: ${updated.fullName}`,
          },
        });
        return updated;
      });
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException('Phone number is already registered');
      throw error;
    }
  }

  async archive(id: string, actorId: string) {
    return this.changeStatus(id, EmployeeStatus.ARCHIVED, actorId, 'EMPLOYEE_ARCHIVED');
  }

  async activate(id: string, actorId: string) {
    return this.changeStatus(id, EmployeeStatus.ACTIVE, actorId, 'EMPLOYEE_ACTIVATED');
  }

  async deactivate(id: string, actorId: string) {
    return this.changeStatus(id, EmployeeStatus.INACTIVE, actorId, 'EMPLOYEE_DEACTIVATED');
  }

  async restore(id: string, actorId: string) {
    const employee = await this.findOne(id);
    if (employee.status !== EmployeeStatus.ARCHIVED) {
      throw new ConflictException('Only an archived employee can be restored');
    }
    return this.changeStatus(id, EmployeeStatus.ACTIVE, actorId, 'EMPLOYEE_RESTORED');
  }

  async remove(id: string, actorId: string) {
    const employee = await this.findOne(id);

    await this.prisma.employee.delete({ where: { id } });
    await this.log(actorId, 'EMPLOYEE_DELETED', 'Employee', id, `Deleted employee: ${employee.fullName}`);
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

  private async changeStatus(
    id: string,
    status: EmployeeStatus,
    actorId: string,
    action: string,
  ) {
    const employee = await this.findOne(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.employee.update({ where: { id }, data: { status } });
      await tx.activityLog.create({
        data: {
          userId: actorId,
          action,
          entity: 'Employee',
          entityId: id,
          description: `${action.replaceAll('_', ' ').toLowerCase()}: ${employee.fullName}`,
        },
      });
      return item;
    });
    return updated;
  }

  private normalizePhone(value: string): string {
    try {
      return normalizeUzbekPhone(value);
    } catch {
      throw new BadRequestException('Phone must be a valid Uzbekistan phone number');
    }
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
