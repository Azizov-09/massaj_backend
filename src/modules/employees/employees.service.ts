import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto, actorId: string) {
    const employee = await this.prisma.employee.create({
      data: {
        fullName: dto.fullName,
        position: dto.position,
        phone: dto.phone,
        email: dto.email,
        salary: dto.salary ? dto.salary : null,
        notes: dto.notes,
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : undefined,
      },
    });

    await this.log(actorId, 'EMPLOYEE_CREATED', 'Employee', employee.id, `Created employee: ${employee.fullName}`);
    return employee;
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
      ...(status && { status }),
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

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.position && { position: dto.position }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.status && { status: dto.status }),
        ...(dto.salary !== undefined && { salary: dto.salary }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.log(actorId, 'EMPLOYEE_UPDATED', 'Employee', id, `Updated employee: ${updated.fullName}`);
    return updated;
  }

  async archive(id: string, actorId: string) {
    const employee = await this.findOne(id);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.ARCHIVED },
    });

    await this.log(actorId, 'EMPLOYEE_ARCHIVED', 'Employee', id, `Archived employee: ${employee.fullName}`);
    return updated;
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
}
