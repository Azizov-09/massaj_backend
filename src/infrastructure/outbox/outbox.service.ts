import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
export interface OutboxJob { eventId: string; }
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService, @InjectQueue('outbox') private readonly queue: Queue<OutboxJob>) {}
  @Cron('* * * * *') async dispatchPending(): Promise<void> { const events = await this.prisma.outboxEvent.findMany({ where: { status: OutboxStatus.PENDING, availableAt: { lte: new Date() } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 100 }); for (const event of events) { const claimed = await this.prisma.outboxEvent.updateMany({ where: { id: event.id, status: OutboxStatus.PENDING }, data: { status: OutboxStatus.PROCESSING, attemptCount: { increment: 1 } } }); if (claimed.count !== 1) continue; try { await this.queue.add('dispatch', { eventId: event.id }, { jobId: event.id, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 500, removeOnFail: 1000 }); } catch (error) { await this.prisma.outboxEvent.update({ where: { id: event.id }, data: { status: OutboxStatus.PENDING, availableAt: new Date(Date.now() + 60_000), lastError: error instanceof Error ? error.message : 'Queue unavailable' } }); } } }
}
