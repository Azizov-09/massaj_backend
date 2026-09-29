import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { AppointmentStatus } from '@prisma/client';

export interface ReminderJobData {
  appointmentId: string;
  type: '24h' | '2h';
}

/**
 * Schedules appointment reminder jobs in BullMQ.
 * Uses cron to scan upcoming appointments and enqueue delayed jobs.
 * Job deduplication: BullMQ jobId is deterministic (type:appointmentId).
 */
@Injectable()
export class AppointmentReminderScheduler {
  private readonly logger = new Logger(AppointmentReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('reminders') private readonly queue: Queue<ReminderJobData>,
  ) {}

  /**
   * Run every 15 minutes — scans appointments in the next 26h window
   * and enqueues 24h and 2h reminder jobs if not already queued.
   */
  @Cron('*/15 * * * *')
  async scheduleReminders(): Promise<void> {
    const now = new Date();
    const in26h = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const upcoming = await this.prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        startAt: { gte: now, lte: in26h },
      },
      select: { id: true, startAt: true },
    });

    for (const appointment of upcoming) {
      const startMs = appointment.startAt.getTime();
      const nowMs = now.getTime();

      // 24-hour reminder
      const delay24h = startMs - 24 * 60 * 60 * 1000 - nowMs;
      if (delay24h > 0) {
        await this.queue.add('appointment-reminder', { appointmentId: appointment.id, type: '24h' }, {
          jobId: `reminder:24h:${appointment.id}`,
          delay: delay24h,
          removeOnComplete: true,
          removeOnFail: 3,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        }).catch(() => { /* Already queued — deduplication handled by jobId. */ });
      }

      // 2-hour reminder
      const delay2h = startMs - 2 * 60 * 60 * 1000 - nowMs;
      if (delay2h > 0) {
        await this.queue.add('appointment-reminder', { appointmentId: appointment.id, type: '2h' }, {
          jobId: `reminder:2h:${appointment.id}`,
          delay: delay2h,
          removeOnComplete: true,
          removeOnFail: 3,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        }).catch(() => { /* Already queued — deduplication handled by jobId. */ });
      }
    }
  }
}
