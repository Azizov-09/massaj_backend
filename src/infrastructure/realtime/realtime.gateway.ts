import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { AppConfiguration } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { allowTrustedFrontendOrigin } from '../../common/utils/http-config.util';

interface JwtPayload { sub: string; sid: string; role: string; tv: number; exp: number; }

/**
 * WebSocket gateway for real-time in-app notifications.
 *
 * Authentication: Client passes the access token through handshake auth or Authorization header.
 * Never trust client-supplied userId — always derive from the verified JWT.
 *
 * Each authenticated socket is joined to a room named after its userId,
 * allowing targeted broadcasts from any service using `emitToUser`.
 */
interface SocketData {
  userId?: string;
}

interface AuthenticatedSocket extends Socket {
  data: SocketData;
}

@WebSocketGateway({
  cors: {
    origin: allowTrustedFrontendOrigin,
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly userSockets = new Map<string, Set<string>>();
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfiguration>,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const handshakeAuth: unknown = client.handshake.auth;
      const authToken =
        typeof handshakeAuth === 'object' &&
        handshakeAuth !== null &&
        'token' in handshakeAuth &&
        typeof handshakeAuth.token === 'string'
          ? handshakeAuth.token
          : undefined;
      const authorization = client.handshake.headers.authorization;
      const token =
        typeof authToken === 'string'
          ? authToken
          : authorization?.startsWith('Bearer ')
            ? authorization.slice(7)
            : undefined;
      if (!token) throw new WsException('Authentication token is required');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow('jwt.accessSecret', { infer: true }),
      });
      if (!payload.sid) throw new WsException('Access token is not bound to a session');
      const [user, session] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { status: true, tokenVersion: true },
        }),
        this.prisma.userSession.findUnique({
          where: { id: payload.sid },
          select: { userId: true, revokedAt: true, expiresAt: true },
        }),
      ]);
      if (
        !user ||
        user.status !== UserStatus.ACTIVE ||
        user.tokenVersion !== payload.tv ||
        !session ||
        session.userId !== payload.sub ||
        session.revokedAt !== null ||
        session.expiresAt <= new Date()
      ) {
        throw new WsException('Session is no longer valid');
      }
      // Associate socket with userId room
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);

      const existing = this.userSockets.get(payload.sub) ?? new Set();
      existing.add(client.id);
      this.userSockets.set(payload.sub, existing);

      const expiresInMs = payload.exp * 1000 - Date.now();
      const timer = setTimeout(() => client.disconnect(true), expiresInMs);
      timer.unref();
      this.expiryTimers.set(client.id, timer);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const timer = this.expiryTimers.get(client.id);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(client.id);
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Emit a notification event to a specific user.
   * Called from domain services after persisting the notification.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Ping handler for client-side keep-alive.
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', { ts: Date.now() });
  }
}
