import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AppointmentStatus, NotificationPriority, NotificationType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { ReminderJobData } from './appointment-reminder.scheduler';

/**
 * Processes appointment reminder jobs from BullMQ.
 *
 * CRITICAL: Always re-fetches the appointment before sending.
 * Cancelled / completed / no-show appointments do NOT receive reminders.
 */
@Processor('reminders')
export class AppointmentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { appointmentId, type } = job.data;

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        parent: { include: { user: { select: { id: true, phone: true } } } },
        child: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    });

    if (!appointment) {
      this.logger.warn(`Reminder job ${job.id}: Appointment ${appointmentId} not found — skipping`);
      return;
    }

    // Do not send reminders for cancelled/completed/no-show appointments
    const terminalStatuses: AppointmentStatus[] = [
      AppointmentStatus.CANCELLED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
    ];
    if (terminalStatuses.includes(appointment.status)) {
      this.logger.log(`Reminder job ${job.id}: Appointment ${appointmentId} is in terminal state ${appointment.status} — skipping`);
      return;
    }

    const childName = `${appointment.child.firstName} ${appointment.child.lastName}`;
    const timeLabel = type === '24h' ? '24 hours' : '2 hours';
    const dedupeKey = `appointment-reminder:${type}:${appointmentId}`;

    await this.notifications.create({
      userId: appointment.parent.user.id,
      type: NotificationType.APPOINTMENT,
      priority: NotificationPriority.HIGH,
      title: `Appointment reminder — ${timeLabel}`,
      message: `Reminder: ${childName} has a ${appointment.service.name} appointment in ${timeLabel}.`,
      relatedEntity: 'Appointment',
      relatedEntityId: appointment.id,
      dedupeKey,
      allowSms: true,
    });
  }
}
