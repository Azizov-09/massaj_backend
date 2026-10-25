import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: ServiceStatus) {
    return this.prisma.service.findMany({
      where: status ? { status } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const item = await this.prisma.service.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Service not found');
    return item;
  }

  create(dto: CreateServiceDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.service.create({ data: dto });
      await tx.activityLog.create({
        data: {
          userId: actorId,
          action: 'SERVICE_CREATED',
          entity: 'Service',
          entityId: item.id,
          description: 'Created service catalog item',
        },
      });
      return item;
    });
  }

  update(id: string, dto: UpdateServiceDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.service.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Service not found');
      const item = await tx.service.update({ where: { id }, data: dto });
      await tx.activityLog.create({
        data: {
          userId: actorId,
          action: 'SERVICE_UPDATED',
          entity: 'Service',
          entityId: id,
          description: 'Updated service catalog item; historical appointment and ledger rows are unchanged',
        },
      });
      return item;
    });
  }

  archive(id: string, actorId: string) {
    return this.changeStatus(id, ServiceStatus.ARCHIVED, actorId, 'SERVICE_ARCHIVED');
  }

  restore(id: string, actorId: string) {
    return this.changeStatus(id, ServiceStatus.ACTIVE, actorId, 'SERVICE_RESTORED');
  }

  private changeStatus(id: string, status: ServiceStatus, actorId: string, action: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.service.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!existing) throw new NotFoundException('Service not found');
      const item = await tx.service.update({ where: { id }, data: { status } });
      await tx.activityLog.create({
        data: {
          userId: actorId,
          action,
          entity: 'Service',
          entityId: id,
          description: `Changed service status from ${existing.status} to ${status}; historical relations remain intact`,
          metadata: { from: existing.status, to: status },
        },
      });
      return item;
    });
  }
}
