import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedSuperAdmin } from './super-admin.seed';

jest.mock('argon2');

describe('seedSuperAdmin', () => {
  let mockPrisma: any;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SUPER_ADMIN_PHONE = '+998901000001';
    process.env.SUPER_ADMIN_PASSWORD = 'AdminPassword123!';
    process.env.SUPER_ADMIN_FULL_NAME = 'Super Admin Test';
    process.env.SUPER_ADMIN_EMAIL = 'super@test.uz';

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      admin: {
        create: jest.fn(),
      },
    };

    (argon2.hash as jest.Mock).mockResolvedValue('hashed_super_admin_pass');
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should create a new Super Admin if none exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'user-uuid-1', role: Role.SUPER_ADMIN });

    await seedSuperAdmin(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { phone: '+998901000001' },
      include: { admin: true },
    });
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        fullName: 'Super Admin Test',
        phone: '+998901000001',
        email: 'super@test.uz',
        passwordHash: 'hashed_super_admin_pass',
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        admin: {
          create: {},
        },
      },
    });
  });

  it('should update existing user to SUPER_ADMIN role and create Admin record if missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-id-123',
      phone: '+998901000001',
      role: Role.ADMIN,
      admin: null,
    });
    mockPrisma.user.update.mockResolvedValue({ id: 'existing-id-123', role: Role.SUPER_ADMIN });
    mockPrisma.admin.create.mockResolvedValue({ id: 'admin-uuid-1' });

    await seedSuperAdmin(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'existing-id-123' },
      data: {
        fullName: 'Super Admin Test',
        email: 'super@test.uz',
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash: 'hashed_super_admin_pass',
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    expect(mockPrisma.admin.create).toHaveBeenCalledWith({
      data: { userId: 'existing-id-123' },
    });
  });

  it('should not throw if phone format is invalid', async () => {
    process.env.SUPER_ADMIN_PHONE = 'invalid-phone';

    await expect(seedSuperAdmin(mockPrisma as unknown as PrismaClient)).resolves.not.toThrow();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
