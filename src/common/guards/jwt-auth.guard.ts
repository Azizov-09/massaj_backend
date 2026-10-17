import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestUser } from '../types/request-user.type';
import { PrismaService } from '../../database/prisma.service';
import { AppConfiguration } from '../../config/configuration';
import { UserStatus } from '@prisma/client';

interface AccessPayload { sub: string; sid: string; role: RequestUser['role']; tv: number; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfiguration>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Missing access token');
    try {
      const secret = this.config.get('jwt.accessSecret', { infer: true }) || process.env.JWT_ACCESS_SECRET;
      const payload = await this.jwt.verifyAsync<AccessPayload>(authorization.slice(7), { secret });
      if (!payload.sid) throw new UnauthorizedException('Access token is not bound to a session');
      const [user, session] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { status: true, tokenVersion: true, role: true },
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
        throw new UnauthorizedException('Session is no longer valid');
      }
      request.user = { id: payload.sub, role: user.role, tokenVersion: payload.tv, sessionId: payload.sid };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
