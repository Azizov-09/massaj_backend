import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AppConfiguration } from '../../config/configuration';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

describe('AuthService refresh rotation', () => {
  const repository = {
    findUserByPhone: jest.fn(),
    findUserById: jest.fn(),
    updateUser: jest.fn(),
  };
  const prisma = {
    user: { update: jest.fn() },
    userSession: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const jwt = { verifyAsync: jest.fn(), signAsync: jest.fn() };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        'jwt.refreshSecret': 'refresh-secret',
        'jwt.accessSecret': 'access-secret',
        'jwt.refreshExpiresIn': '30d',
        'jwt.accessExpiresIn': '15m',
      };
      return values[key];
    }),
  };
  let service: AuthService;

  const user = {
    id: 'user-1',
    fullName: 'Admin User',
    phone: '+998901234567',
    email: null,
    passwordHash: 'unused',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 4,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockResolvedValue([]);
    service = new AuthService(
      repository as unknown as AuthRepository,
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService<AppConfiguration>,
    );
  });

  it('atomically claims the old session and binds the new access token to the rotated session', async () => {
    const refreshToken = 'valid-refresh-token';
    const refreshTokenHash = `sha256:${crypto.createHash('sha256').update(refreshToken).digest('hex')}`;
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sid: 'old-session', tv: user.tokenVersion });
    prisma.userSession.findUnique.mockResolvedValue({
      id: 'old-session',
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    prisma.userSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.userSession.create.mockResolvedValue({ id: 'new-session' });
    prisma.userSession.update.mockResolvedValue({});
    jwt.signAsync.mockResolvedValueOnce('new-refresh-token').mockResolvedValueOnce('new-access-token');

    await expect(service.refresh(refreshToken, 'Jest', '127.0.0.1')).resolves.toEqual({
      refreshToken: 'new-refresh-token',
      accessToken: 'new-access-token',
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'old-session', revokedAt: null }),
    }));
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sub: user.id, sid: 'new-session', role: Role.ADMIN, tv: 4 }),
      expect.any(Object),
    );
  });

  it('rejects an expired refresh session', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sid: 'expired-session', tv: user.tokenVersion });
    prisma.userSession.findUnique.mockResolvedValue({
      id: 'expired-session',
      userId: user.id,
      expiresAt: new Date(Date.now() - 1),
      revokedAt: null,
      user,
    });

    await expect(service.refresh('expired-refresh-token')).rejects.toThrow(UnauthorizedException);
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('treats a revoked refresh token as replay and revokes all user sessions', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sid: 'revoked-session', tv: user.tokenVersion });
    prisma.userSession.findUnique.mockResolvedValue({
      id: 'revoked-session',
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user,
    });

    await expect(service.refresh('replayed-refresh-token')).rejects.toThrow('Refresh token reuse detected');
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects a parallel refresh loser and triggers replay containment', async () => {
    const refreshToken = 'parallel-refresh-token';
    const refreshTokenHash = `sha256:${crypto.createHash('sha256').update(refreshToken).digest('hex')}`;
    jwt.verifyAsync.mockResolvedValue({ sub: user.id, sid: 'parallel-session', tv: user.tokenVersion });
    prisma.userSession.findUnique.mockResolvedValue({
      id: 'parallel-session',
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    prisma.userSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refresh(refreshToken)).rejects.toThrow('Refresh token reuse detected');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.userSession.create).not.toHaveBeenCalled();
  });
});
