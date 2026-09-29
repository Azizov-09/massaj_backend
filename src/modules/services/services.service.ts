import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';
@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}
  list(status?: ServiceStatus) { return this.prisma.service.findMany({ where: status ? { status } : undefined, orderBy: { name: 'asc' } }); }
  async get(id: string) { const item = await this.prisma.service.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Service not found'); return item; }
  async create(dto: CreateServiceDto, actorId: string) { const item = await this.prisma.service.create({ data: dto }); await this.log(actorId, 'SERVICE_CREATED', item.id, 'Created service catalog item'); return item; }
  async update(id: string, dto: UpdateServiceDto, actorId: string) { await this.get(id); const item = await this.prisma.service.update({ where: { id }, data: dto }); await this.log(actorId, 'SERVICE_UPDATED', id, 'Updated service catalog item; historical session prices are unchanged'); return item; }
  async archive(id: string, actorId: string) { await this.get(id); const item = await this.prisma.service.update({ where: { id }, data: { status: ServiceStatus.ARCHIVED } }); await this.log(actorId, 'SERVICE_ARCHIVED', id, 'Archived service'); return item; }
  async restore(id: string, actorId: string) { await this.get(id); const item = await this.prisma.service.update({ where: { id }, data: { status: ServiceStatus.ACTIVE } }); await this.log(actorId, 'SERVICE_RESTORED', id, 'Restored service'); return item; }
  private log(userId: string, action: string, entityId: string, description: string) { return this.prisma.activityLog.create({ data: { userId, action, entity: 'Service', entityId, description } }); }
}
