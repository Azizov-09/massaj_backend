import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role, SpecialistStatus } from '@prisma/client';
import { ClinicalService } from './clinical.service';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../../common/services/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestUser } from '../../common/types/request-user.type';

/**
 * ClinicalService security tests.
 *
 * Key invariants verified here:
 *  1. assertChildAccess (via AccessService) is the primary IDOR gate for READ
 *     paths and for SPECIALIST write paths.
 *  2. assertSpecialistChild (private helper) verifies the specialist is ACTIVE
 *     and the child exists — it does NOT re-check the specialist↔child
 *     assignment because assertChildAccess already enforced that for SPECIALIST
 *     callers.  For ADMIN/SUPER_ADMIN callers the assignment check is
 *     intentionally omitted (admins may assign any active specialist).
 *  3. assertSpecialistOwner prevents one specialist from editing another's
 *     existing records.
 */
describe('ClinicalService — security & access control', () => {
  let service: ClinicalService;
  let mockPrisma: any;
  let mockAccess: any;
  let mockNotifications: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (fn: any) => fn(mockPrisma)),
      specialist: { findUnique: jest.fn() },
      child: { findUnique: jest.fn() },
      attendance: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      assessment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      progressEntry: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      goal: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      childParent: { findMany: jest.fn().mockResolvedValue([]) },
    };

    mockAccess = {
      assertChildAccess: jest.fn().mockResolvedValue(undefined),
      currentSpecialistId: jest.fn().mockResolvedValue('spec-profile-1'),
    };

    mockNotifications = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    service = new ClinicalService(
      mockPrisma as unknown as PrismaService,
      mockAccess as unknown as AccessService,
      mockNotifications as unknown as NotificationsService,
    );
  });

  // ─────────────────────────────────────────────
  // assertChildAccess: primary IDOR gate
  // ─────────────────────────────────────────────
  describe('IDOR protection via assertChildAccess', () => {
    it('blocks any role when assertChildAccess throws ForbiddenException', async () => {
      mockAccess.assertChildAccess.mockRejectedValue(
        new ForbiddenException('You do not have access to this child'),
      );

      const attacker: RequestUser = { id: 'evil-spec', role: Role.SPECIALIST, tokenVersion: 0 };
      await expect(
        service.attendances('child-belongs-to-others', attacker),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAccess.assertChildAccess).toHaveBeenCalledWith(
        attacker,
        'child-belongs-to-others',
      );
    });

    it('blocks a PARENT who is not linked to the child from reading attendance', async () => {
      mockAccess.assertChildAccess.mockRejectedValue(
        new ForbiddenException('You do not have access to this child'),
      );

      const unlinkedParent: RequestUser = { id: 'parent-other', role: Role.PARENT, tokenVersion: 0 };
      await expect(
        service.attendances('child-123', unlinkedParent),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─────────────────────────────────────────────
  // createProgress — SPECIALIST path
  // ─────────────────────────────────────────────
  describe('createProgress', () => {
    it('allows SPECIALIST to create a progress entry for an assigned child', async () => {
      const specialistUser: RequestUser = { id: 'spec-user-1', role: Role.SPECIALIST, tokenVersion: 0 };

      // assertChildAccess passes (specialist is already linked via prior records)
      mockAccess.assertChildAccess.mockResolvedValue(undefined);
      // resolveSpecialist → currentSpecialistId returns spec profile id
      mockAccess.currentSpecialistId.mockResolvedValue('spec-profile-1');
      // assertSpecialistChild checks: specialist is ACTIVE, child exists
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'spec-profile-1', status: SpecialistStatus.ACTIVE });
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'child-1' });
      mockPrisma.progressEntry.create.mockResolvedValue({ id: 'prog-1', childId: 'child-1', specialistId: 'spec-profile-1', title: 'T', description: 'D' });

      const result = await service.createProgress(
        { childId: 'child-1', title: 'T', description: 'D', specialistId: undefined },
        specialistUser,
      );

      expect(mockAccess.assertChildAccess).toHaveBeenCalledWith(specialistUser, 'child-1');
      expect(mockAccess.currentSpecialistId).toHaveBeenCalledWith('spec-user-1');
      expect(result.childId).toBe('child-1');
    });

    it('blocks SPECIALIST with INACTIVE status from creating progress (assertSpecialistChild)', async () => {
      const specialistUser: RequestUser = { id: 'spec-user-inactive', role: Role.SPECIALIST, tokenVersion: 0 };

      mockAccess.assertChildAccess.mockResolvedValue(undefined);
      mockAccess.currentSpecialistId.mockResolvedValue('spec-inactive-id');
      // INACTIVE specialist must be blocked
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'spec-inactive-id', status: SpecialistStatus.INACTIVE });
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'child-1' });

      await expect(
        service.createProgress({ childId: 'child-1', title: 'T', description: 'D', specialistId: undefined }, specialistUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns NotFoundException when child does not exist during progress creation', async () => {
      const specialistUser: RequestUser = { id: 'spec-user-1', role: Role.SPECIALIST, tokenVersion: 0 };

      mockAccess.assertChildAccess.mockResolvedValue(undefined);
      mockAccess.currentSpecialistId.mockResolvedValue('spec-profile-1');
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'spec-profile-1', status: SpecialistStatus.ACTIVE });
      // child not found
      mockPrisma.child.findUnique.mockResolvedValue(null);

      await expect(
        service.createProgress({ childId: 'ghost-child', title: 'T', description: 'D', specialistId: undefined }, specialistUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('SPECIALIST cannot create progress for a child they have no access to (IDOR)', async () => {
      const attacker: RequestUser = { id: 'attacker-spec', role: Role.SPECIALIST, tokenVersion: 0 };

      // assertChildAccess rejects — attacker has no records linked to this child
      mockAccess.assertChildAccess.mockRejectedValue(
        new ForbiddenException('You do not have access to this child'),
      );

      await expect(
        service.createProgress({ childId: 'victim-child', title: 'T', description: 'D', specialistId: undefined }, attacker),
      ).rejects.toThrow(ForbiddenException);

      // Ensure the DB write was never attempted
      expect(mockPrisma.progressEntry.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // createGoal — same IDOR protection
  // ─────────────────────────────────────────────
  describe('createGoal', () => {
    it('SPECIALIST cannot create a goal for a child they have no access to (IDOR)', async () => {
      const attacker: RequestUser = { id: 'attacker-spec', role: Role.SPECIALIST, tokenVersion: 0 };

      mockAccess.assertChildAccess.mockRejectedValue(
        new ForbiddenException('You do not have access to this child'),
      );

      await expect(
        service.createGoal({ childId: 'victim-child', description: 'D', specialistId: undefined }, attacker),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.goal.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // assertSpecialistOwner — prevents cross-specialist edits
  // ─────────────────────────────────────────────
  describe('assertSpecialistOwner — cross-specialist edit prevention', () => {
    it('prevents SPECIALIST from updating another specialist\'s progress entry', async () => {
      const rivalSpec: RequestUser = { id: 'rival-user', role: Role.SPECIALIST, tokenVersion: 0 };

      mockPrisma.progressEntry.findUnique.mockResolvedValue({
        id: 'prog-1',
        specialistId: 'original-spec-profile',
      });
      // rival's profile id is different
      mockAccess.currentSpecialistId.mockResolvedValue('rival-spec-profile');

      await expect(
        service.updateProgress('prog-1', { description: 'hacked' }, rivalSpec),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.progressEntry.update).not.toHaveBeenCalled();
    });

    it('prevents SPECIALIST from updating another specialist\'s goal', async () => {
      const rivalSpec: RequestUser = { id: 'rival-user', role: Role.SPECIALIST, tokenVersion: 0 };

      mockPrisma.goal.findUnique.mockResolvedValue({
        id: 'goal-1',
        specialistId: 'original-spec-profile',
      });
      mockAccess.currentSpecialistId.mockResolvedValue('rival-spec-profile');

      await expect(
        service.updateGoal('goal-1', { description: 'hacked' }, rivalSpec),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.goal.update).not.toHaveBeenCalled();
    });

    it('prevents SPECIALIST from updating another specialist\'s assessment', async () => {
      const rivalSpec: RequestUser = { id: 'rival-user', role: Role.SPECIALIST, tokenVersion: 0 };

      mockPrisma.assessment.findUnique.mockResolvedValue({
        id: 'assess-1',
        specialistId: 'original-spec-profile',
      });
      mockAccess.currentSpecialistId.mockResolvedValue('rival-spec-profile');

      await expect(
        service.updateAssessment('assess-1', { professionalObservation: 'hacked' }, rivalSpec),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.assessment.update).not.toHaveBeenCalled();
    });

    it('allows ADMIN to update any specialist\'s records without owning them', async () => {
      const admin: RequestUser = { id: 'admin-user', role: Role.ADMIN, tokenVersion: 0 };

      mockPrisma.progressEntry.findUnique.mockResolvedValue({
        id: 'prog-1',
        specialistId: 'some-spec-profile',
      });
      mockPrisma.progressEntry.update.mockResolvedValue({ id: 'prog-1' });

      await expect(
        service.updateProgress('prog-1', { description: 'admin-override' }, admin),
      ).resolves.not.toThrow();

      // Admin bypasses assertSpecialistOwner — no currentSpecialistId call needed
      expect(mockAccess.currentSpecialistId).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // ADMIN — assertSpecialistChild for admin-assigned specialist
  // ─────────────────────────────────────────────
  describe('ADMIN assigning specialist via createProgress', () => {
    it('allows ADMIN to assign any ACTIVE specialist to a child via specialistId param', async () => {
      const admin: RequestUser = { id: 'admin-1', role: Role.ADMIN, tokenVersion: 0 };

      mockAccess.assertChildAccess.mockResolvedValue(undefined);
      // ADMIN path: resolveSpecialist uses requestedId directly
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'new-spec-id', status: SpecialistStatus.ACTIVE });
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'child-1' });
      mockPrisma.progressEntry.create.mockResolvedValue({ id: 'prog-new', childId: 'child-1', specialistId: 'new-spec-id', title: 'T', description: 'D' });

      const result = await service.createProgress(
        { childId: 'child-1', specialistId: 'new-spec-id', title: 'T', description: 'D' },
        admin,
      );

      expect(result.specialistId).toBe('new-spec-id');
      // ADMIN does not need assertChildAccess to pass (returns void by default)
      expect(mockPrisma.progressEntry.create).toHaveBeenCalled();
    });

    it('blocks ADMIN from assigning an INACTIVE specialist (assertSpecialistChild)', async () => {
      const admin: RequestUser = { id: 'admin-1', role: Role.ADMIN, tokenVersion: 0 };

      mockAccess.assertChildAccess.mockResolvedValue(undefined);
      mockPrisma.specialist.findUnique.mockResolvedValue({ id: 'inactive-spec', status: SpecialistStatus.INACTIVE });
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'child-1' });

      await expect(
        service.createProgress({ childId: 'child-1', specialistId: 'inactive-spec', title: 'T', description: 'D' }, admin),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
