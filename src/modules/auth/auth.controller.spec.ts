import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
      refreshToken: 'refresh-456',
      user: { id: 'u1', phone: '+998901234567' },
    });
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-456',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });
});
