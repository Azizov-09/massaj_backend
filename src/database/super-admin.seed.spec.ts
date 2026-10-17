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

  it('refuses to silently elevate an existing non-SUPER_ADMIN account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-id-123',
      phone: '+998901000001',
      role: Role.ADMIN,
      admin: null,
    });
    await expect(seedSuperAdmin(mockPrisma as unknown as PrismaClient)).rejects.toThrow(
      'not a complete SUPER_ADMIN profile',
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.admin.create).not.toHaveBeenCalled();
  });

  it('does not reset credentials or unlock an existing SUPER_ADMIN on startup', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'existing-id-123',
      phone: '+998901000001',
      role: Role.SUPER_ADMIN,
      admin: { id: 'admin-1' },
    });

    await seedSuperAdmin(mockPrisma as unknown as PrismaClient);

    expect(argon2.hash).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('skips bootstrap when credentials are not configured', async () => {
    delete process.env.SUPER_ADMIN_PHONE;
    delete process.env.SUPER_ADMIN_PASSWORD;
    delete process.env.SUPER_ADMIN_FULL_NAME;

    await seedSuperAdmin(mockPrisma as unknown as PrismaClient);

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should not throw if phone format is invalid', async () => {
    process.env.SUPER_ADMIN_PHONE = 'invalid-phone';

    await expect(seedSuperAdmin(mockPrisma as unknown as PrismaClient)).resolves.not.toThrow();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
