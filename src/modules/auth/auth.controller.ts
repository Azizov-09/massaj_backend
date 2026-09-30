import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequestUser } from '../../common/types/request-user.type';
import { ChangePasswordDto, LoginDto, RefreshDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'User Login',
    description:
      'Authenticates user with phone number and password. Returns short-lived JWT access token and sets HttpOnly refresh cookie.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful. Returns access token and user profile.' })
  @ApiResponse({ status: 400, description: 'Invalid phone or password format.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive account.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded (5 requests/minute).' })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto.phone, dto.password, request.headers['user-agent'], request.ip);
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return { accessToken: result.tokens.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh Access Token',
    description: 'Exchanges a valid refresh token for a new access token and rotated refresh token.',
  })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or revoked refresh token.' })
  async refresh(@Body() dto: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const tokens = await this.auth.refresh(dto.refreshToken, request.headers['user-agent'], request.ip);
    this.setRefreshCookie(response, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'User Logout',
    description: 'Revokes the current session and clears the refresh cookie.',
  })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: 204, description: 'Logged out successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logout(@Body() dto: RefreshDto, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(dto.refreshToken);
    response.clearCookie('refresh_token');
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Logout From All Devices',
    description: 'Increments user token version, invalidating all issued sessions and tokens across all devices.',
  })
  @ApiResponse({ status: 204, description: 'All sessions successfully revoked.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logoutAll(@CurrentUser() user: RequestUser, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logoutAll(user.id);
    response.clearCookie('refresh_token');
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Change Password',
    description: 'Verifies current password and sets a new complex password, invalidating other sessions.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 204, description: 'Password changed successfully.' })
  @ApiResponse({ status: 400, description: 'Weak new password or same password.' })
  @ApiResponse({ status: 401, description: 'Current password incorrect or unauthorized.' })
  async changePassword(@CurrentUser() user: RequestUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });
  }
}
