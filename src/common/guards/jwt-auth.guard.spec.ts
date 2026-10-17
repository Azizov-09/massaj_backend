import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AppConfiguration } from '../../config/configuration';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard session revocation', () => {
  const jwt = { verifyAsync: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const prisma = {
    user: { findUnique: jest.fn() },
    userSession: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue('access-secret') };
  let guard: JwtAuthGuard;
  let request: { headers: { authorization?: string }; user?: unknown };
  let context: ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    config.get.mockReturnValue('access-secret');
    guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<AppConfiguration>,
    );
    request = { headers: { authorization: 'Bearer access-token' } };
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  });

  it('accepts an active access token bound to an active session and uses the database role', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 'session-1', role: Role.PARENT, tv: 3 });
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE, tokenVersion: 3, role: Role.ADMIN });
    prisma.userSession.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', role: Role.ADMIN, tokenVersion: 3, sessionId: 'session-1' });
  });

  it('rejects an access token immediately after its session is revoked', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 'session-1', role: Role.ADMIN, tv: 3 });
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE, tokenVersion: 3, role: Role.ADMIN });
    prisma.userSession.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects legacy or forged access tokens without a session id', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', role: Role.ADMIN, tv: 3 });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
  });
});
