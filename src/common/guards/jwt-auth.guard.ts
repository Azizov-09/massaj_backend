import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RequestUser } from '../types/request-user.type';
import { PrismaService } from '../../database/prisma.service';
import { UserStatus } from '@prisma/client';

interface AccessPayload { sub: string; role: RequestUser['role']; tv: number; }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Missing access token');
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(authorization.slice(7));
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true, tokenVersion: true } });
      if (!user || user.status !== UserStatus.ACTIVE || user.tokenVersion !== payload.tv) throw new UnauthorizedException('Session is no longer valid');
      request.user = { id: payload.sub, role: payload.role, tokenVersion: payload.tv };
      return true;
    } catch { throw new UnauthorizedException('Invalid or expired access token'); }
  }
}
