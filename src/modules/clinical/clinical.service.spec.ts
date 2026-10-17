import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Role, SpecialistStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { AccessService } from '../../common/services/access.service';
import { RequestUser } from '../../common/types/request-user.type';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClinicalService } from './clinical.service';
import { CreateAssessmentDto } from './dto/clinical.dto';

describe('ClinicalService', () => {
  let service: ClinicalService;
  let prisma: any;
  let access: any;
  let notifications: any;

  const admin: RequestUser = { id: 'admin-user', role: Role.ADMIN, tokenVersion: 0 };
  const specialist: RequestUser = { id: 'specialist-user', role: Role.SPECIALIST, tokenVersion: 0 };
  const relations = {
    child: { id: 'child-1', firstName: 'Umar', lastName: 'Karimov' },
    specialist: { id: 'specialist-1', user: { fullName: 'Nilufar Ahmedova' } },
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (value: any) =>
        typeof value === 'function' ? value(prisma) : Promise.all(value),
      ),
      specialist: { findUnique: jest.fn() },
      child: { findUnique: jest.fn() },
      childParent: { findMany: jest.fn().mockResolvedValue([]) },
      attendance: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      assessment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      progressEntry: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    access = {
      assertChildAccess: jest.fn().mockResolvedValue(undefined),
      currentSpecialistId: jest.fn().mockResolvedValue('specialist-1'),
    };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    service = new ClinicalService(
      prisma as PrismaService,
      access as AccessService,
      notifications as NotificationsService,
    );
  });

  it('returns assessment child and specialist identities in list responses', async () => {
    prisma.assessment.findMany.mockResolvedValue([
      { id: 'assessment-1', childId: 'child-1', specialistId: 'specialist-1', assessedAt: new Date(), ...relations },
    ]);
    prisma.assessment.count.mockResolvedValue(1);

    const result = await service.listAssessments({ page: 1, limit: 20 }, admin);

    expect(result.items[0]).toEqual(expect.objectContaining({
      child: expect.objectContaining({ fullName: 'Umar Karimov' }),
      specialist: expect.objectContaining({ fullName: 'Nilufar Ahmedova' }),
      assessmentDate: expect.any(Date),
    }));
    expect(result.meta.total).toBe(1);
  });

  it('checks child access before returning assessment details', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      id: 'assessment-1', childId: 'child-1', specialistId: 'specialist-1', assessedAt: new Date(), ...relations,
    });

    const result = await service.assessmentById('assessment-1', specialist);

    expect(access.assertChildAccess).toHaveBeenCalledWith(specialist, 'child-1');
    expect(result.child.fullName).toBe('Umar Karimov');
    expect(result.specialist.fullName).toBe('Nilufar Ahmedova');
  });

  it('rejects a future completed progress record before writing', async () => {
    prisma.specialist.findUnique.mockResolvedValue({ status: SpecialistStatus.ACTIVE });
    prisma.child.findUnique.mockResolvedValue({ id: 'child-1' });
    await expect(service.createProgress({
      childId: 'child-1',
      title: 'Session result',
      description: 'Completed work',
      occurredAt: '2099-01-01T10:00:00.000Z',
    }, specialist)).rejects.toThrow(BadRequestException);

    expect(prisma.progressEntry.create).not.toHaveBeenCalled();
  });

  it('rejects cross-child clinical access', async () => {
    access.assertChildAccess.mockRejectedValue(new ForbiddenException('Access denied'));
    await expect(service.progress('victim-child', specialist)).rejects.toThrow(ForbiddenException);
    expect(prisma.progressEntry.findMany).not.toHaveBeenCalled();
  });

  it('rejects an inactive specialist before creating an assessment', async () => {
    prisma.specialist.findUnique.mockResolvedValue({ status: SpecialistStatus.INACTIVE });
    prisma.child.findUnique.mockResolvedValue({ id: 'child-1' });
    await expect(service.createAssessment({
      childId: 'child-1',
      specialistId: 'specialist-1',
      professionalObservation: 'Observation',
    }, admin)).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 for a missing progress record', async () => {
    prisma.progressEntry.findUnique.mockResolvedValue(null);
    await expect(service.progressById('missing', admin)).rejects.toThrow(NotFoundException);
  });

  it('returns progress child and specialist identities in paginated responses', async () => {
    prisma.progressEntry.findMany.mockResolvedValue([{
      id: 'progress-1',
      childId: 'child-1',
      specialistId: 'specialist-1',
      occurredAt: new Date(),
      createdBy: { id: 'admin-user', fullName: 'Admin User', role: Role.ADMIN },
      ...relations,
    }]);
    prisma.progressEntry.count.mockResolvedValue(1);

    const result = await service.listProgress({ page: 1, limit: 20 }, admin);

    expect(result.items[0]).toEqual(expect.objectContaining({
      child: expect.objectContaining({ fullName: 'Umar Karimov' }),
      specialist: expect.objectContaining({ fullName: 'Nilufar Ahmedova' }),
      progressDate: expect.any(Date),
    }));
  });

  it('stores the progress author separately from the treating specialist', async () => {
    prisma.specialist.findUnique.mockResolvedValue({ status: SpecialistStatus.ACTIVE });
    prisma.child.findUnique.mockResolvedValue({ id: 'child-1' });
    prisma.progressEntry.create.mockResolvedValue({
      id: 'progress-1',
      childId: 'child-1',
      specialistId: 'specialist-1',
      occurredAt: new Date(),
      createdBy: { id: admin.id, fullName: 'Admin User', role: Role.ADMIN },
      ...relations,
    });

    const result = await service.createProgress({
      childId: 'child-1',
      specialistId: 'specialist-1',
      title: 'Milestone',
      description: 'Observed by the treating specialist',
    }, admin);

    expect(prisma.progressEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ createdById: admin.id, specialistId: 'specialist-1' }),
    }));
    expect(result.recordedBy).toEqual(expect.objectContaining({ id: admin.id, role: Role.ADMIN }));
  });

  it('fails safely instead of inventing identities for a corrupted assessment relation', async () => {
    prisma.assessment.findMany.mockResolvedValue([{
      id: 'assessment-corrupt',
      childId: 'missing-child',
      specialistId: 'specialist-1',
      assessedAt: new Date(),
      child: null,
      specialist: relations.specialist,
    }]);
    prisma.assessment.count.mockResolvedValue(1);

    await expect(service.listAssessments({ page: 1, limit: 20 }, admin))
      .rejects.toThrow(InternalServerErrorException);
  });

  it('prevents a specialist from updating another specialist progress record', async () => {
    prisma.progressEntry.findUnique.mockResolvedValue({ id: 'progress-1', specialistId: 'specialist-2' });

    await expect(service.updateProgress('progress-1', { description: 'Unauthorized edit' }, specialist))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.progressEntry.update).not.toHaveBeenCalled();
  });

  it('prevents a specialist from updating another specialist assessment', async () => {
    prisma.assessment.findUnique.mockResolvedValue({ id: 'assessment-1', specialistId: 'specialist-2' });

    await expect(service.updateAssessment(
      'assessment-1',
      { professionalObservation: 'Unauthorized edit' },
      specialist,
    )).rejects.toThrow(ForbiddenException);
    expect(prisma.assessment.update).not.toHaveBeenCalled();
  });
});

describe('CreateAssessmentDto', () => {
  it('accepts clinical text up to the documented string length', async () => {
    const dto = Object.assign(new CreateAssessmentDto(), {
      childId: '1d9a81f7-7c31-4e55-9872-05511675d59c',
      movement: 'Normal movement',
      professionalObservation: 'Stable improvement',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects clinical text longer than 3000 characters', async () => {
    const dto = Object.assign(new CreateAssessmentDto(), {
      childId: '1d9a81f7-7c31-4e55-9872-05511675d59c',
      movement: 'x'.repeat(3001),
      professionalObservation: 'Stable improvement',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'movement')).toBe(true);
  });
});
