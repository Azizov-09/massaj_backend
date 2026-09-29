import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AppConfiguration } from '../../config/configuration';
import { normalizeUzbekPhone } from '../../common/utils/phone.util';
import { assertPasswordPolicy } from '../../common/utils/security.util';
import { AuthRepository } from './auth.repository';

interface RefreshPayload { sub: string; sid: string; tv: number; }
export interface AuthTokens { accessToken: string; refreshToken: string; }
export interface PublicUser { id: string; fullName: string; phone: string; role: User['role']; }

@Injectable()
export class AuthService {
  private readonly maxLoginFailures = 5;
  private readonly lockoutMs = 15 * 60 * 1000;
  constructor(private readonly repository: AuthRepository, private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService<AppConfiguration>) {}

  async login(phoneInput: string, password: string, device?: string, ip?: string): Promise<{ tokens: AuthTokens; user: PublicUser }> {
    let phone: string;
    try { phone = normalizeUzbekPhone(phoneInput); } catch { throw new UnauthorizedException('Invalid phone or password'); }
    const user = await this.repository.findUserByPhone(phone);
    const now = new Date();
    if (!user || user.status !== UserStatus.ACTIVE || (user.lockedUntil !== null && user.lockedUntil > now)) throw new UnauthorizedException('Invalid phone or password');
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      const failures = user.failedLoginCount + 1;
      await this.repository.updateUser(user.id, { failedLoginCount: failures, lockedUntil: failures >= this.maxLoginFailures ? new Date(now.getTime() + this.lockoutMs) : null });
      throw new UnauthorizedException('Invalid phone or password');
    }
    await this.repository.updateUser(user.id, { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now });
    const tokens = await this.issueSessionTokens(user, device, ip);
    return { tokens, user: this.toPublicUser(user) };
  }

  async refresh(refreshToken: string, device?: string, ip?: string): Promise<AuthTokens> {
    let payload: RefreshPayload;
    try { payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: this.config.getOrThrow('jwt.refreshSecret', { infer: true }) }); }
    catch { throw new UnauthorizedException('Invalid refresh token'); }
    const session = await this.prisma.userSession.findUnique({ where: { id: payload.sid }, include: { user: true } });
    if (!session || session.userId !== payload.sub || session.expiresAt <= new Date()) throw new UnauthorizedException('Invalid refresh token');
    if (session.revokedAt) {
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: payload.sub }, data: { tokenVersion: { increment: 1 } } }),
        this.prisma.userSession.updateMany({ where: { userId: payload.sub, revokedAt: null }, data: { revokedAt: new Date() } }),
      ]);
      throw new UnauthorizedException('Refresh token reuse detected; all sessions revoked');
    }
    if (session.user.status !== UserStatus.ACTIVE || session.user.tokenVersion !== payload.tv || !(await argon2.verify(session.refreshTokenHash, refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueSessionTokens(session.user, device, ip);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: this.config.getOrThrow('jwt.refreshSecret', { infer: true }), ignoreExpiration: true });
      await this.prisma.userSession.updateMany({ where: { id: payload.sid, userId: payload.sub, revokedAt: null }, data: { revokedAt: new Date() } });
    } catch { /* Logout is deliberately idempotent. */ }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
      this.prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) throw new UnauthorizedException('Current password is incorrect');
    try { assertPasswordPolicy(newPassword); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid password'); }
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date(), tokenVersion: { increment: 1 } } }),
      this.prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.activityLog.create({ data: { userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId, description: 'Password changed and sessions revoked' } }),
    ]);
  }

  private async issueSessionTokens(user: User, device?: string, ip?: string): Promise<AuthTokens> {
    const expiresIn = this.config.getOrThrow('jwt.refreshExpiresIn', { infer: true });
    const expiresAt = new Date(Date.now() + this.parseDuration(expiresIn));
    const provisional = await this.prisma.userSession.create({ data: { userId: user.id, refreshTokenHash: 'pending', device, ip, expiresAt } });
    const refreshToken = await this.jwt.signAsync({ sub: user.id, sid: provisional.id, tv: user.tokenVersion }, { secret: this.config.getOrThrow('jwt.refreshSecret', { infer: true }), expiresIn: expiresIn as JwtSignOptions['expiresIn'] });
    await this.prisma.userSession.update({ where: { id: provisional.id }, data: { refreshTokenHash: await argon2.hash(refreshToken, { type: argon2.argon2id }) } });
    const accessExpiresIn = this.config.getOrThrow('jwt.accessExpiresIn', { infer: true });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, tv: user.tokenVersion }, { secret: this.config.getOrThrow('jwt.accessSecret', { infer: true }), expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'] });
    return { accessToken, refreshToken };
  }

  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value); if (!match) throw new Error('JWT_REFRESH_EXPIRES_IN must use a number followed by s, m, h, or d');
    const amount = Number(match[1]); const unit = match[2]; const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return amount * multiplier;
  }
  private toPublicUser(user: User): PublicUser { return { id: user.id, fullName: user.fullName, phone: user.phone, role: user.role }; }
}
