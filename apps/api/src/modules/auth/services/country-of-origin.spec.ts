import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SettingsService } from '../../settings/settings.service';
import { PropertiesService } from '../../properties/core/properties.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from './email.service';
import { WhatsAppAuthOtpService } from './whatsapp-auth-otp.service';
import { StorageService } from '../../properties/core/storage.service';
import { PropertyWhatsAppService } from '../../properties/core/property-whatsapp.service';
import { PropertyEmailService } from '../../properties/core/property-email.service';
import { OrgType, UserRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Country of Origin vs Ethnicity Strict Semantic Separation QA', () => {
  let authService: AuthService;
  let settingsService: SettingsService;
  let propertiesService: PropertiesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        create: jest.fn(),
        update: jest.fn(),
      },
      orgStaff: {
        create: jest.fn(),
      },
      resident: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      property: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SettingsService,
        PropertiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        {
          provide: EmailService,
          useValue: {
            sendMail: jest.fn(),
            sendVerificationOtp: jest.fn(),
            sendAccountCreationNotification: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: WhatsAppAuthOtpService,
          useValue: {
            sendRegistrationOtp: jest.fn().mockResolvedValue({ sent: true, channel: 'whatsapp' }),
            sendLoginOtp: jest.fn().mockResolvedValue({ sent: true, channel: 'whatsapp' }),
            sendPasswordResetOtp: jest.fn().mockResolvedValue({ sent: true, channel: 'whatsapp' }),
          },
        },
        {
          provide: StorageService,
          useValue: { upload: jest.fn() },
        },
        {
          provide: PropertyWhatsAppService,
          useValue: {
            notifyListingConfirmed: jest.fn(),
            notifyPropertyQueryReceived: jest.fn(),
            notifyPropertyMessageReceived: jest.fn(),
          },
        },
        {
          provide: PropertyEmailService,
          useValue: {
            notifyListingConfirmed: jest.fn(),
            notifyPropertyQueryReceived: jest.fn(),
            notifyPropertyMessageReceived: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    settingsService = module.get<SettingsService>(SettingsService);
    propertiesService = module.get<PropertiesService>(PropertiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. An existing ethnicity value such as "Asian" is never returned as Country of Origin', () => {
    it('should return null/empty for countryOfOrigin even when user has legacy ethnicity "Asian"', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-legacy-1',
        email: 'legacy-asian@example.com',
        firstName: 'Kenji',
        lastName: 'Sato',
        role: UserRole.STUDENT,
        accountStatus: 'ACTIVE',
        phone: '0412345678',
        countryCode: '+61',
        countryOfOrigin: null,
        ethnicity: 'Asian',
        dateOfBirth: new Date('2000-01-01'),
        allowPublicContactDetails: false,
        orgStaffRoles: [],
      });

      const profile = await settingsService.getProfile('u-legacy-1');

      // Crucial: countryOfOrigin MUST NOT be populated with "Asian"
      expect(profile.countryOfOrigin).toBeNull();
      expect(profile.countryOfOrigin).not.toBe('Asian');
      expect(profile.ethnicity).toBe('Asian');

      // Profile completion check must consider countryOfOrigin missing
      expect(profile.profileCompletion.isComplete).toBe(false);
      expect(profile.profileCompletion.missingFields).toContain('countryOfOrigin');
    });
  });

  describe('2. An existing ethnicity value such as "Hispanic" is never saved into countryOfOrigin', () => {
    it('should NOT populate countryOfOrigin when a legacy registration sends ethnicity "Hispanic"', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation((args: any) => Promise.resolve({ id: 'u-new', ...args.data }));

      await authService.registerStudent({
        email: 'hispanic-student@example.com',
        password: 'Password123!',
        firstName: 'Carlos',
        lastName: 'Rodriguez',
        countryCode: '+61',
        phone: '411222333',
        ethnicity: 'Hispanic',
        dateOfBirth: '1998-05-10',
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.ethnicity).toBe('Hispanic');
      expect(createCall.data.countryOfOrigin).toBeUndefined();
    });

    it('should reject invalid country codes like "Hispanic" or "Asian" in updateProfile', async () => {
      await expect(
        settingsService.updateProfile('u-1', { countryOfOrigin: 'Hispanic' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        settingsService.updateProfile('u-1', { countryOfOrigin: 'Asian' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. A valid Country of Origin selection is saved correctly', () => {
    it('should save a valid ISO-3166-1 alpha-2 code ("AU") correctly during student registration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation((args: any) => Promise.resolve({ id: 'u-au', ...args.data }));

      await authService.registerStudent({
        email: 'aussie@example.com',
        password: 'Password123!',
        firstName: 'Liam',
        lastName: 'Smith',
        countryCode: '+61',
        phone: '412345678',
        countryOfOrigin: 'AU',
        dateOfBirth: '2001-09-09',
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.countryOfOrigin).toBe('AU');
      expect(createCall.data.ethnicity).toBeUndefined();
    });

    it('should save a valid ISO code ("SG") correctly in updateProfile and normalize to uppercase', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u-sg',
        countryOfOrigin: 'SG',
        ethnicity: null,
      });

      await settingsService.updateProfile('u-sg', { countryOfOrigin: 'sg' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-sg' },
          data: expect.objectContaining({
            countryOfOrigin: 'SG',
          }),
        }),
      );
    });
  });

  describe('4. Updating Country of Origin does not overwrite legacy ethnicity data', () => {
    it('should update countryOfOrigin without touching or wiping legacy ethnicity', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u-persist',
        countryOfOrigin: 'GB',
        ethnicity: 'White',
      });

      await settingsService.updateProfile('u-persist', { countryOfOrigin: 'GB' });

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.countryOfOrigin).toBe('GB');
      // ethnicity is NOT modified or overwritten
      expect(updateCall.data.ethnicity).toBeUndefined();
    });

    it('should update resident countryOfOrigin without overwriting legacy resident ethnicity', async () => {
      jest.spyOn(propertiesService as any, 'getPropertyForProvider').mockResolvedValue({ id: 'p-1', maximumOccupancy: 5 });
      prisma.resident.findUnique.mockResolvedValue({
        id: 'res-legacy',
        propertyId: 'p-1',
        name: 'Maria',
        countryOfOrigin: null,
        ethnicity: 'Hispanic',
        isActive: true,
      });
      prisma.resident.update.mockImplementation((args: any) => Promise.resolve({ id: 'res-legacy', ...args.data }));

      await propertiesService.updateResident('p-1', { id: 'u-mgr' }, 'res-legacy', {
        countryOfOrigin: 'ES',
      });

      const updateCall = prisma.resident.update.mock.calls[0][0];
      expect(updateCall.data.countryOfOrigin).toBe('ES');
      expect(updateCall.data.ethnicity).toBeUndefined();
    });
  });

  describe('5. Null Country of Origin remains supported', () => {
    it('should allow setting countryOfOrigin to null in updateProfile', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u-null',
        countryOfOrigin: null,
      });

      await settingsService.updateProfile('u-null', { countryOfOrigin: null });

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.countryOfOrigin).toBeNull();
    });

    it('should allow empty string to reset countryOfOrigin to null', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u-empty',
        countryOfOrigin: null,
      });

      await settingsService.updateProfile('u-empty', { countryOfOrigin: '' });

      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data.countryOfOrigin).toBeNull();
    });
  });

  describe('6. Registration and profile updates behave consistently', () => {
    it('should consistently normalize lowercase country codes across provider and student registrations', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue({ id: 'org-prov', name: 'Student Living' });
      prisma.user.create.mockImplementation((args: any) => Promise.resolve({ id: 'u-prov', ...args.data }));

      await authService.registerProvider({
        email: 'provider-test@example.com',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Manager',
        countryCode: '+61',
        phone: '412345678',
        countryOfOrigin: 'de',
        dateOfBirth: '1985-04-12',
        organizationName: 'Student Living Co',
        organizationType: OrgType.PROVIDER,
      });

      const provCreate = prisma.user.create.mock.calls[0][0];
      expect(provCreate.data.countryOfOrigin).toBe('DE');
      expect(provCreate.data.ethnicity).toBeUndefined();
    });
  });

  describe('7. Public resident profiles never expose ethnicity under the Country of Origin label', () => {
    it('should strictly return undefined for countryOfOrigin if resident has only legacy ethnicity', async () => {
      prisma.property.findUnique.mockResolvedValue({
        id: 'p-pub',
        title: 'Modern House',
        status: 'PUBLISHED',
        organization: { settings: {} },
        residents: [
          {
            id: 'res-pub-1',
            name: 'Kenji',
            age: 23,
            countryOfOrigin: null,
            ethnicity: 'Asian',
            occupation: 'Student',
            shortBio: 'Quiet',
            photoUrl: null,
            publicVisibility: { countryOfOrigin: true, ethnicity: true, age: true },
          },
          {
            id: 'res-pub-2',
            name: 'Sophie',
            age: 22,
            countryOfOrigin: 'FR',
            ethnicity: null,
            occupation: 'Student',
            shortBio: null,
            photoUrl: null,
            publicVisibility: { countryOfOrigin: true },
          },
        ],
        houseRule: null,
      });

      const pub = await propertiesService.getPublicProperty('p-pub');

      // Resident 1 has legacy ethnicity "Asian", but countryOfOrigin is null
      // It MUST NEVER return "Asian" under countryOfOrigin!
      expect(pub.residents[0].countryOfOrigin).toBeUndefined();
      expect(pub.residents[0].ethnicity).toBe('Asian');

      // Resident 2 has countryOfOrigin "FR"
      expect(pub.residents[1].countryOfOrigin).toBe('FR');
      expect(pub.residents[1].ethnicity).toBeUndefined();
    });
  });
});
