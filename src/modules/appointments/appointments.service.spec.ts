import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AppointmentStatus, Role, ServiceStatus, SpecialistStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../../common/services/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestUser } from '../../common/types/request-user.type';

describe('AppointmentsService Unit Tests', () => {
  let service: AppointmentsService;
  let mockPrisma: any;
  let mockAccess: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
      appointment: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      child: {
        findUnique: jest.fn(),
      },
      childParent: {
        findUnique: jest.fn(),
      },
      parent: {
        findUniqueOrThrow: jest.fn(),
      },
      specialist: {
        findUnique: jest.fn(),
      },
      service: {
        findUnique: jest.fn(),
      },
      session: {
        create: jest.fn(),
      },
      activityLog: {
        create: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
    };
    mockAccess = {};
    mockNotifications = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    service = new AppointmentsService(
      mockPrisma as unknown as PrismaService,
      mockAccess as unknown as AccessService,
      mockNotifications as unknown as NotificationsService,
    );
  });

  describe('Appointment State Machine Transitions', () => {
    it('allows SCHEDULED -> CONFIRMED transition', async () => {
      mockPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await service.confirm('appt-1', 'admin-id');
      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(mockPrisma.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appt-1', status: { in: [AppointmentStatus.SCHEDULED] } },
        data: { status: AppointmentStatus.CONFIRMED },
      });
    });

    it('rejects invalid transition (e.g. COMPLETED -> CANCELLED)', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.COMPLETED,
        parent: { userId: 'parent-user' },
        specialist: { userId: 'spec-user' },
      });
      // updateMany returns 0 when current status not in allowed list
      mockPrisma.appointment.updateMany.mockResolvedValue({ count: 0 });

      const adminUser: RequestUser = { id: 'admin-id', role: Role.ADMIN, tokenVersion: 0 };
      await expect(service.cancel('appt-1', adminUser)).rejects.toThrow(BadRequestException);
    });

    it('allows SCHEDULED -> CANCELLED transition', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.SCHEDULED,
        parent: { userId: 'parent-user' },
        specialist: { userId: 'spec-user' },
      });
      mockPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.CANCELLED,
      });

      const parentUser: RequestUser = { id: 'parent-user', role: Role.PARENT, tokenVersion: 0 };
      const result = await service.cancel('appt-1', parentUser);
      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('allows SCHEDULED -> NO_SHOW transition by specialist or admin', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.SCHEDULED,
        parent: { userId: 'parent-user' },
        specialist: { userId: 'spec-user' },
      });
      mockPrisma.appointment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.appointment.findUniqueOrThrow.mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.NO_SHOW,
      });

      const specUser: RequestUser = { id: 'spec-user', role: Role.SPECIALIST, tokenVersion: 0 };
      const result = await service.noShow('appt-1', specUser);
      expect(result.status).toBe(AppointmentStatus.NO_SHOW);
    });

    it('denies parent from setting NO_SHOW on appointment', async () => {
      mockPrisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-1',
        status: AppointmentStatus.SCHEDULED,
        parent: { userId: 'parent-user' },
        specialist: { userId: 'spec-user' },
      });

      const parentUser: RequestUser = { id: 'parent-user', role: Role.PARENT, tokenVersion: 0 };
      await expect(service.noShow('appt-1', parentUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Validation & Conflict Checking', () => {
    it('throws BadRequestException if endAt is before or equal to startAt', async () => {
      const startAt = new Date('2026-10-01T10:00:00Z').toISOString();
      const endAt = new Date('2026-10-01T09:00:00Z').toISOString();

      await expect(
        service.create(
          {
            childId: 'c1',
            parentId: 'p1',
            specialistId: 's1',
            serviceId: 'srv1',
            startAt,
            endAt,
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if specialist has an overlapping appointment', async () => {
      const startAt = new Date('2026-10-01T10:00:00Z').toISOString();
      const endAt = new Date('2026-10-01T11:00:00Z').toISOString();

      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
      mockPrisma.childParent.findUnique.mockResolvedValue({ id: 'cp1' });
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 's1', status: SpecialistStatus.ACTIVE });
      mockPrisma.service.findUnique.mockResolvedValue({ id: 'srv1', status: ServiceStatus.ACTIVE });

      // Overlap detected:
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'existing-appt-id' });

      await expect(
        service.create(
          {
            childId: 'c1',
            parentId: 'p1',
            specialistId: 's1',
            serviceId: 'srv1',
            startAt,
            endAt,
          },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if child is not active', async () => {
      const startAt = new Date('2026-10-01T10:00:00Z').toISOString();
      const endAt = new Date('2026-10-01T11:00:00Z').toISOString();

      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1', status: 'ARCHIVED' });
      mockPrisma.childParent.findUnique.mockResolvedValue({ id: 'cp1' });
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 's1', status: SpecialistStatus.ACTIVE });
      mockPrisma.service.findUnique.mockResolvedValue({ id: 'srv1', status: ServiceStatus.ACTIVE });

      await expect(
        service.create(
          {
            childId: 'c1',
            parentId: 'p1',
            specialistId: 's1',
            serviceId: 'srv1',
            startAt,
            endAt,
          },
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Session Start from Appointment', () => {
    it('creates Session snapshot and updates appointment to IN_PROGRESS atomically', async () => {
      const appt = {
        id: 'appt-1',
        childId: 'c1',
        parentId: 'p1',
        specialistId: 's1',
        serviceId: 'srv1',
        status: AppointmentStatus.CONFIRMED,
        parent: { userId: 'parent-user' },
        specialist: { userId: 'spec-user' },
        service: { price: 150_000 },
      };
      mockPrisma.appointment.findUnique.mockResolvedValue(appt);
      mockPrisma.appointment.update.mockResolvedValue({ ...appt, status: AppointmentStatus.IN_PROGRESS });
      mockPrisma.session.create.mockResolvedValue({
        id: 'sess-1',
        appointmentId: 'appt-1',
        servicePriceSnapshot: 150_000,
        status: 'IN_PROGRESS',
      });

      const specUser: RequestUser = { id: 'spec-user', role: Role.SPECIALIST, tokenVersion: 0 };
      const res = await service.start('appt-1', specUser);

      expect(res.session.servicePriceSnapshot).toBe(150_000);
      expect(mockPrisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: 'appt-1',
            servicePriceSnapshot: 150_000,
          }),
        }),
      );
    });
  });
});
