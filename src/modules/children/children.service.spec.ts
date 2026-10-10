import { Role } from '@prisma/client';
import { ChildrenService } from './children.service';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../../common/services/access.service';
import { RequestUser } from '../../common/types/request-user.type';

describe('ChildrenService Unit Tests', () => {
  let service: ChildrenService;
  let mockPrisma: any;
  let mockAccess: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
      child: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      activityLog: {
        create: jest.fn(),
      },
    };

    mockAccess = {
      assertChildAccess: jest.fn().mockResolvedValue(undefined),
    };

    service = new ChildrenService(
      mockPrisma as unknown as PrismaService,
      mockAccess as unknown as AccessService,
    );
  });

  describe('list', () => {
    it('returns standardized pagination metadata with totalPages', async () => {
      mockPrisma.child.findMany.mockResolvedValue([{ id: 'c1', firstName: 'Jasur' }]);
      mockPrisma.child.count.mockResolvedValue(25);

      const adminUser: RequestUser = { id: 'admin-1', role: Role.ADMIN, tokenVersion: 0 };
      const res = await service.list({ page: 1, limit: 10 }, adminUser);

      expect(res.meta).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
      expect(res.items).toHaveLength(1);
    });

    it('searches child by parent name and phone number in OR condition', async () => {
      mockPrisma.child.findMany.mockResolvedValue([]);
      mockPrisma.child.count.mockResolvedValue(0);

      const adminUser: RequestUser = { id: 'admin-1', role: Role.ADMIN, tokenVersion: 0 };
      await service.list({ page: 1, limit: 10, search: '90123' }, adminUser);

      expect(mockPrisma.child.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { firstName: { contains: '90123', mode: 'insensitive' } },
              { lastName: { contains: '90123', mode: 'insensitive' } },
              {
                parents: {
                  some: {
                    parent: {
                      user: {
                        OR: [
                          { fullName: { contains: '90123', mode: 'insensitive' } },
                          { phone: { contains: '90123' } },
                        ],
                      },
                    },
                  },
                },
              },
            ]),
          }),
        }),
      );
    });

    it('restricts child list for SPECIALIST to only children with clinical links', async () => {
      mockPrisma.child.findMany.mockResolvedValue([]);
      mockPrisma.child.count.mockResolvedValue(0);

      const specialistUser: RequestUser = { id: 'spec-u1', role: Role.SPECIALIST, tokenVersion: 0 };
      await service.list({ page: 1, limit: 10 }, specialistUser);

      expect(mockPrisma.child.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              {
                OR: [
                  { attendances: { some: { specialist: { userId: 'spec-u1' } } } },
                  { assessments: { some: { specialist: { userId: 'spec-u1' } } } },
                  { goals: { some: { specialist: { userId: 'spec-u1' } } } },
                  { progressEntries: { some: { specialist: { userId: 'spec-u1' } } } },
                ],
              },
            ],
          }),
        }),
      );
    });
  });

  describe('get', () => {
    it('verifies access via AccessService before returning child details', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({ id: 'c1', firstName: 'Ali' });
      const user: RequestUser = { id: 'u1', role: Role.SPECIALIST, tokenVersion: 0 };

      const res = await service.get('c1', user);
      expect(mockAccess.assertChildAccess).toHaveBeenCalledWith(user, 'c1');
      expect(res).toEqual({ id: 'c1', firstName: 'Ali' });
    });
  });
});
