import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { AppConfiguration } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway session authentication', () => {
  const jwt = { verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('access-secret') };
  const prisma = {
    user: { findUnique: jest.fn() },
    userSession: { findUnique: jest.fn() },
  };
  let gateway: RealtimeGateway;
  let client: any;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RealtimeGateway(
      jwt as unknown as JwtService,
      config as unknown as ConfigService<AppConfiguration>,
      prisma as unknown as PrismaService,
    );
    client = {
      id: 'socket-1',
      data: {},
      handshake: { auth: { token: 'access-token' }, headers: {} },
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };
  });

  it('joins a user room only for an active token-bound session', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      tv: 2,
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE, tokenVersion: 2 });
    prisma.userSession.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.disconnect).not.toHaveBeenCalled();
    gateway.handleDisconnect(client);
  });

  it('disconnects a socket whose backing session was revoked', async () => {
    jwt.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      tv: 2,
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE, tokenVersion: 2 });
    prisma.userSession.findUnique.mockResolvedValue({
      userId: 'user-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await gateway.handleConnection(client);

    expect(client.join).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
});
