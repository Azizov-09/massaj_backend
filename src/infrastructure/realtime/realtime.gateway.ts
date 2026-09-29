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
import { AppConfiguration } from '../../config/configuration';

interface JwtPayload { sub: string; role: string; tv: number; }

/**
 * WebSocket gateway for real-time in-app notifications.
 *
 * Authentication: Client must pass ?token=<accessToken> in the handshake query.
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

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL, credentials: true }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfiguration>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = client.handshake.query.token as string | undefined;
      if (!token) throw new WsException('Authentication token is required');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow('jwt.accessSecret', { infer: true }),
      });
      // Associate socket with userId room
      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);

      const existing = this.userSockets.get(payload.sub) ?? new Set();
      existing.add(client.id);
      this.userSockets.set(payload.sub, existing);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
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
