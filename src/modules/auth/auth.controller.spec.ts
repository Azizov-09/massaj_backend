import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ForbiddenException } from '@nestjs/common';

describe('AuthController Rate Limiting & Auth Unit Tests', () => {
  let controller: AuthController;
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      changePassword: jest.fn(),
    };
    controller = new AuthController(mockAuthService as unknown as AuthService);
  });

  it('has @Throttle decorator configured on login endpoint with 5 requests per 60s', () => {
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.login);
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', AuthController.prototype.login);

    expect(limit).toBe(5);
    expect(ttl).toBe(60_000);
  });

  it('login delegates to AuthService and sets cookie', async () => {
    mockAuthService.login.mockResolvedValue({
      tokens: { accessToken: 'access-123', refreshToken: 'refresh-456' },
      user: { id: 'u1', phone: '+998901234567' },
    });

    const mockReq: any = { headers: { 'user-agent': 'Jest-Agent' }, ip: '127.0.0.1' };
    const mockRes: any = { cookie: jest.fn() };

    const result = await controller.login(
      { phone: '+998901234567', password: 'Password123!' },
      mockReq,
      mockRes,
    );

    expect(result).toEqual({
      accessToken: 'access-123',
      user: { id: 'u1', phone: '+998901234567' },
    });
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-456',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });

  it('rotates a cookie refresh token without exposing it in the JSON response', async () => {
    mockAuthService.refresh.mockResolvedValue({
      accessToken: 'rotated-access',
      refreshToken: 'rotated-refresh',
    });
    const mockReq: any = {
      headers: { origin: 'http://localhost:5173', 'user-agent': 'Jest-Agent' },
      cookies: { refresh_token: 'cookie-refresh-token' },
      ip: '127.0.0.1',
    };
    const mockRes: any = { cookie: jest.fn() };

    const result = await controller.refresh({}, mockReq, mockRes);

    expect(mockAuthService.refresh).toHaveBeenCalledWith(
      'cookie-refresh-token',
      'Jest-Agent',
      '127.0.0.1',
    );
    expect(result).toEqual({ accessToken: 'rotated-access' });
    expect(result).not.toHaveProperty('refreshToken');
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'rotated-refresh',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects refresh requests from an untrusted browser origin', async () => {
    const mockReq: any = {
      headers: { origin: 'https://attacker.example' },
      cookies: { refresh_token: 'cookie-refresh-token' },
    };
    const mockRes: any = { cookie: jest.fn() };

    await expect(controller.refresh({}, mockReq, mockRes)).rejects.toThrow(ForbiddenException);
    expect(mockAuthService.refresh).not.toHaveBeenCalled();
  });

  it('revokes the refresh session and clears its cookie on logout', async () => {
    const mockReq: any = {
      headers: { origin: 'http://localhost:5173' },
      cookies: { refresh_token: 'cookie-refresh-token' },
    };
    const mockRes: any = { clearCookie: jest.fn() };

    await controller.logout({}, mockReq, mockRes);

    expect(mockAuthService.logout).toHaveBeenCalledWith('cookie-refresh-token');
    expect(mockRes.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });
});
