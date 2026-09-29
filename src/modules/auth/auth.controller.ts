import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('login') @HttpCode(200) @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto.phone, dto.password, request.headers['user-agent'], request.ip);
    this.setRefreshCookie(response, result.tokens.refreshToken); return { accessToken: result.tokens.accessToken, user: result.user };
  }
  @Public() @Post('refresh') @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.refresh(dto.refreshToken, request.headers['user-agent'], request.ip); this.setRefreshCookie(response, tokens.refreshToken); return { accessToken: tokens.accessToken };
  }
  @ApiBearerAuth() @Post('logout') @HttpCode(204)
  async logout(@Body() dto: RefreshDto, @Res({ passthrough: true }) response: Response): Promise<void> { await this.auth.logout(dto.refreshToken); response.clearCookie('refresh_token'); }
  @ApiBearerAuth() @Post('logout-all') @HttpCode(204)
  async logoutAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) response: Response): Promise<void> { await this.auth.logoutAll(user.id); response.clearCookie('refresh_token'); }
  @ApiBearerAuth() @Post('change-password') @HttpCode(204)
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto): Promise<void> { await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword); }
  private setRefreshCookie(response: Response, refreshToken: string): void { response.cookie('refresh_token', refreshToken, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/api/v1/auth' }); }
}
