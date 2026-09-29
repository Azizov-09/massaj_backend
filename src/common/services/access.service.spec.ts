import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AccessService } from './access.service';
import { PrismaService } from '../../database/prisma.service';
import { RequestUser } from '../types/request-user.type';

describe('AccessService (Permission Helpers & IDOR Protection)', () => {
  let service: AccessService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      child: {
        findUnique: jest.fn(),
      },
      childParent: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      parent: {
        findUnique: jest.fn(),
      },
      specialist: {
        findUnique: jest.fn(),
      },
      appointment: {
        findFirst: jest.fn(),
      },
    };
    service = new AccessService(mockPrisma as unknown as PrismaService);
  });

  describe('assertChildAccess', () => {
    it('throws NotFoundException if child does not exist', async () => {
      mockPrisma.child.findUnique.mockResolvedValue(null);
      const user: RequestUser = { id: 'user-1', role: Role.ADMIN, phone: '+998901234567' };

      await expect(service.assertChildAccess(user, 'non-existent-child')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows SUPER_ADMIN and ADMIN access unconditionally if child exists', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1' });
      const superAdmin: RequestUser = { id: 'u-1', role: Role.SUPER_ADMIN, phone: '+998901234567' };
      const admin: RequestUser = { id: 'u-2', role: Role.ADMIN, phone: '+998901234568' };

      await expect(service.assertChildAccess(superAdmin, 'c1')).resolves.not.toThrow();
      await expect(service.assertChildAccess(admin, 'c1')).resolves.not.toThrow();
    });

    it('allows PARENT access if relationship exists in ChildParent', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1' });
      mockPrisma.childParent.findFirst.mockResolvedValue({ id: 'cp1' });

      const parentUser: RequestUser = { id: 'parent-user-1', role: Role.PARENT, phone: '+998901234569' };
      await expect(service.assertChildAccess(parentUser, 'c1')).resolves.not.toThrow();
      expect(mockPrisma.childParent.findFirst).toHaveBeenCalledWith({
        where: { childId: 'c1', parent: { userId: 'parent-user-1' } },
        select: { id: true },
      });
    });

    it('prevents IDOR: throws ForbiddenException if PARENT is not linked to child', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1' });
      mockPrisma.childParent.findFirst.mockResolvedValue(null);

      const attackerParent: RequestUser = { id: 'other-parent-user', role: Role.PARENT, phone: '+998909999999' };
      await expect(service.assertChildAccess(attackerParent, 'c1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows SPECIALIST access if specialist has an appointment with child', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1' });
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'spec-profile-1' });
      mockPrisma.appointment.findFirst.mockResolvedValue({ id: 'appt-1' });

      const specialistUser: RequestUser = { id: 'spec-user-1', role: Role.SPECIALIST, phone: '+998905555555' };
      await expect(service.assertChildAccess(specialistUser, 'c1')).resolves.not.toThrow();
    });

    it('prevents IDOR: throws ForbiddenException if SPECIALIST has no appointment with child', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1' });
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'spec-profile-1' });
      mockPrisma.appointment.findFirst.mockResolvedValue(null);

      const specialistUser: RequestUser = { id: 'spec-user-1', role: Role.SPECIALIST, phone: '+998905555555' };
      await expect(service.assertChildAccess(specialistUser, 'c1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('assertParentOwnsChild', () => {
    it('passes if childId_parentId composite relation exists', async () => {
      mockPrisma.childParent.findUnique.mockResolvedValue({ id: 'cp1' });
      await expect(service.assertParentOwnsChild('p1', 'c1')).resolves.not.toThrow();
    });

    it('throws ForbiddenException if parent does not own child', async () => {
      mockPrisma.childParent.findUnique.mockResolvedValue(null);
      await expect(service.assertParentOwnsChild('p-wrong', 'c1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('currentParentId & currentSpecialistId', () => {
    it('returns parent ID when profile exists', async () => {
      mockPrisma.parent.findUnique.mockResolvedValue({ id: 'p-100' });
      const parentId = await service.currentParentId('u-1');
      expect(parentId).toBe('p-100');
    });

    it('throws ForbiddenException when parent profile is missing', async () => {
      mockPrisma.parent.findUnique.mockResolvedValue(null);
      await expect(service.currentParentId('u-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns specialist ID when profile is ACTIVE', async () => {
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'spec-100', status: 'ACTIVE' });
      const specialistId = await service.currentSpecialistId('u-2');
      expect(specialistId).toBe('spec-100');
    });

    it('throws ForbiddenException when specialist is INACTIVE or missing', async () => {
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'spec-100', status: 'INACTIVE' });
      await expect(service.currentSpecialistId('u-2')).rejects.toThrow(ForbiddenException);
    });
  });
});
