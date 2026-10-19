import {
  allowTrustedFrontendOrigin,
  normalizeHttpOrigin,
  trustedFrontendOrigins,
} from './http-config.util';

describe('HTTP origin configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalFrontendOrigins = process.env.FRONTEND_ORIGINS;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
    if (originalFrontendOrigins === undefined) delete process.env.FRONTEND_ORIGINS;
    else process.env.FRONTEND_ORIGINS = originalFrontendOrigins;
  });

  it('normalizes configured URLs to browser Origin format', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://crm.example.com/app/';
    process.env.FRONTEND_ORIGINS = 'https://admin.example.com/, https://crm.example.com';

    expect(trustedFrontendOrigins()).toEqual([
      'https://admin.example.com',
      'https://crm.example.com',
    ]);
    expect(normalizeHttpOrigin('http://localhost:5173/')).toBe('http://localhost:5173');
  });

  it('allows a configured realtime origin and rejects an untrusted origin', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://crm.example.com/';
    delete process.env.FRONTEND_ORIGINS;
    const allow = jest.fn();
    const reject = jest.fn();

    allowTrustedFrontendOrigin('https://crm.example.com', allow);
    allowTrustedFrontendOrigin('https://attacker.example', reject);

    expect(allow).toHaveBeenCalledWith(null, true);
    expect(reject).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects an insecure configured production origin', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://crm.example.com';
    process.env.FRONTEND_ORIGINS = 'http://admin.example.com';

    expect(() => trustedFrontendOrigins()).toThrow('must use HTTPS');
  });
});
