import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { UserRole } from '@prisma/client';

describe('AuthController - Caching, Profiles & Session Recovery', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      login2fa: jest.fn(),
      verifyEmail: jest.fn(),
      resendOtp: jest.fn(),
      registerStudent: jest.fn(),
      registerProvider: jest.fn(),
      forgotPassword: jest.fn(),
      verifyResetOtp: jest.fn(),
      resetPassword: jest.fn(),
      requestLoginOtp: jest.fn(),
      verifyLoginOtp: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('getProfile (/auth/me)', () => {
    it('should return user profile matching both root and nested user object structures', () => {
      const mockReq = {
        user: {
          id: 'usr-student-1',
          email: 'student@jesmond.demo',
          role: UserRole.STUDENT,
        },
      };

      const result = controller.getProfile(mockReq);

      expect(result).toBeDefined();
      expect(result.id).toBe('usr-student-1');
      expect(result.email).toBe('student@jesmond.demo');
      expect(result.role).toBe(UserRole.STUDENT);
      expect(result.user).toEqual(mockReq.user);
    });

    it('should return complete organization context for ORG_STAFF users', () => {
      const mockReq = {
        user: {
          id: 'usr-services-1',
          email: 'services@jesmond.demo',
          role: UserRole.ORG_STAFF,
          organizationId: 'org-services-1',
          orgType: 'RETAIL',
          businessCategory: 'SERVICES',
          orgRole: 'MANAGER',
          permissions: ['SERVICES_MANAGE'],
        },
      };

      const result = controller.getProfile(mockReq);

      expect(result.role).toBe(UserRole.ORG_STAFF);
      expect(result.orgType).toBe('RETAIL');
      expect(result.businessCategory).toBe('SERVICES');
      expect(result.user.orgType).toBe('RETAIL');
      expect(result.user.businessCategory).toBe('SERVICES');
    });
  });
});
