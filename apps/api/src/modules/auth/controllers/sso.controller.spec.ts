import { Test, TestingModule } from '@nestjs/testing';
import { SsoController } from './sso.controller';
import { SsoService } from '../services/sso.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SsoController (Dual Portal SSO Endpoints)', () => {
  let controller: SsoController;
  let ssoService: any;
  let prisma: any;

  beforeEach(async () => {
    ssoService = {
      generateAuthorizationCode: jest.fn().mockResolvedValue({
        code: 'auth-code-xyz-123',
        state: 'state-abc',
        redirect_uri: 'https://business.jesmond.com.au/auth/callback',
        expires_in: 60,
      }),
      exchangeAuthorizationCode: jest.fn().mockResolvedValue({
        access_token: 'signed.jwt.token',
        token_type: 'Bearer',
        expires_in: 604800,
        session: { id: 'sess-123', expiresAt: new Date() },
        user: { id: 'usr-123', email: 'test@jesmond.com.au' },
      }),
      checkBusinessAccess: jest.fn().mockResolvedValue({
        userId: 'usr-123',
        hasBusinessAccess: true,
        organizations: [{ organizationId: 'org-1' }],
      }),
      logoutSession: jest.fn().mockResolvedValue({
        success: true,
        message: 'Session successfully revoked',
      }),
    };

    prisma = {
      orgStaff: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SsoController],
      providers: [
        { provide: SsoService, useValue: ssoService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get<SsoController>(SsoController);
  });

  describe('POST /auth/sso/authorize', () => {
    it('should generate an authorization code for the authenticated user', async () => {
      const req = { user: { id: 'usr-123' } };
      const dto = {
        response_type: 'code',
        client_id: 'jesmond-business-portal',
        redirect_uri: 'https://business.jesmond.com.au/auth/callback',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        state: 'nonce-state-123',
      };

      const result = await controller.authorize(req, dto);
      expect(result.code).toBe('auth-code-xyz-123');
      expect(ssoService.generateAuthorizationCode).toHaveBeenCalledWith(
        req.user,
        dto,
      );
    });
  });

  describe('POST /auth/sso/exchange', () => {
    it('should exchange code and set host session cookie in secure context', async () => {
      const req = {
        ip: '127.0.0.1',
        secure: true,
        headers: { 'user-agent': 'Chrome', 'x-forwarded-proto': 'https' },
      };
      const res = { cookie: jest.fn() };
      const dto = {
        grant_type: 'authorization_code',
        code: 'auth-code-xyz-123',
        client_id: 'jesmond-business-portal',
        redirect_uri: 'https://business.jesmond.com.au/auth/callback',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        state: 'nonce-state-123',
      };

      const result = await controller.exchange(req, res, dto);
      expect(result.access_token).toBe('signed.jwt.token');
      expect(ssoService.exchangeAuthorizationCode).toHaveBeenCalledWith(
        dto,
        { ipAddress: '127.0.0.1', userAgent: 'Chrome' },
      );
      expect(res.cookie).toHaveBeenCalledWith(
        '__Host-business-session',
        'signed.jwt.token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('should set non-prefixed session cookie in local plain HTTP context to prevent browser drop', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete process.env.COOKIE_SECURE;

      const req = {
        ip: '127.0.0.1',
        secure: false,
        headers: { 'user-agent': 'Chrome', 'x-forwarded-proto': 'http' },
      };
      const res = { cookie: jest.fn() };
      const dto = {
        grant_type: 'authorization_code',
        code: 'auth-code-xyz-123',
        client_id: 'jesmond-business-portal',
        redirect_uri: 'http://business.localhost:3000/auth/callback',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
        state: 'nonce-state-123',
      };

      await controller.exchange(req, res, dto);
      expect(res.cookie).toHaveBeenCalledWith(
        'business-session',
        'signed.jwt.token',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
        }),
      );

      process.env.NODE_ENV = origEnv;
    });
  });

  describe('GET /auth/sso/business-check', () => {
    it('should return business access verification for authenticated user', async () => {
      const req = { user: { id: 'usr-123' } };
      const result = await controller.checkBusinessAccess(req);
      expect(result.hasBusinessAccess).toBe(true);
      expect(ssoService.checkBusinessAccess).toHaveBeenCalledWith('usr-123');
    });
  });

  describe('POST /auth/sso/logout', () => {
    it('should revoke session and clear all portal cookies', async () => {
      const req = { user: { id: 'usr-123', sessionId: 'sess-active-99' } };
      const res = { clearCookie: jest.fn() };

      const result = await controller.logout(req, res, {});
      expect(result.success).toBe(true);
      expect(ssoService.logoutSession).toHaveBeenCalledWith(
        'usr-123',
        'sess-active-99',
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        '__Host-business-session',
        expect.objectContaining({ path: '/', secure: true }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        '__Host-student-session',
        expect.objectContaining({ path: '/', secure: true }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'business-session',
        expect.objectContaining({ path: '/' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'student-session',
        expect.objectContaining({ path: '/' }),
      );
    });
  });
});
