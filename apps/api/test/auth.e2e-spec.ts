import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { AccountStatus } from '@prisma/client';

describe('Auth Controller - Signup Email Verification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Student Signup Flow', () => {
    const testEmail1 = 'newstudent1@example.com';
    const testEmail2 = 'unverifiedstudent@example.com';
    const testEmail3 = 'verifiedstudent@example.com';
    const testEmail4 = 'idempotentstudent@example.com';
    const password = 'Password123!';
    const turnstileToken = 'dummy-token';

    beforeAll(async () => {
      // Clean up test emails and their relations
      await prisma.session.deleteMany({ where: { user: { email: { in: [testEmail1, testEmail2, testEmail3, testEmail4] } } } });
      await prisma.user.deleteMany({ where: { email: { in: [testEmail1, testEmail2, testEmail3, testEmail4] } } });
    });

    it('1. NEW EMAIL: should register successfully and remain unverified', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register/student')
        .send({
          email: testEmail1,
          password,
          firstName: 'New',
          lastName: 'Student',
          turnstileToken,
        })
        .expect(201);

      expect(res.body.requiresEmailVerification).toBe(true);
      expect(res.body.email).toBe(testEmail1);

      const user = await prisma.user.findUnique({ where: { email: testEmail1 } });
      expect(user).toBeDefined();
      expect(user.emailVerified).toBe(false);
      expect(user.accountStatus).toBe(AccountStatus.PENDING_VERIFICATION);
      expect(user.emailVerificationToken).toBeDefined();
    });

    it('2. EXISTING UNVERIFIED EMAIL: should allow signup again and update details', async () => {
      // First signup
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/student')
        .send({
          email: testEmail2,
          password,
          firstName: 'Initial',
          lastName: 'Name',
          turnstileToken,
        })
        .expect(201);

      const userBefore = await prisma.user.findUnique({ where: { email: testEmail2 } });
      expect(userBefore.emailVerified).toBe(false);

      // Second signup attempt
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register/student')
        .send({
          email: testEmail2,
          password: 'NewPassword123!',
          firstName: 'Updated',
          lastName: 'Name',
          turnstileToken,
        })
        .expect(201); // MUST NOT return 409

      expect(res.body.requiresEmailVerification).toBe(true);

      const userAfter = await prisma.user.findUnique({ where: { email: testEmail2 } });
      expect(userAfter.firstName).toBe('Updated'); // Confirm details updated
      expect(userAfter.emailVerificationToken).toBeDefined();
      expect(userAfter.emailVerificationToken).not.toBe(userBefore.emailVerificationToken); // New OTP
    });

    it('3. EXISTING VERIFIED EMAIL: should return ConflictException', async () => {
      // Register
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/student')
        .send({
          email: testEmail3,
          password,
          firstName: 'Verified',
          lastName: 'Student',
          turnstileToken,
        })
        .expect(201);

      // Verify it manually in DB for this test
      await prisma.user.update({
        where: { email: testEmail3 },
        data: { emailVerified: true, accountStatus: AccountStatus.ACTIVE },
      });

      // Attempt signup again
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register/student')
        .send({
          email: testEmail3,
          password,
          firstName: 'Verified',
          lastName: 'Student',
          turnstileToken,
        })
        .expect(409); // Conflict

      expect(res.body.message).toBe('Email already in use.');
      
      // Ensure no duplicate records (Prisma unique constraint already prevents this, but good to check conceptually)
      const count = await prisma.user.count({ where: { email: testEmail3 } });
      expect(count).toBe(1);
    });

    it('4. OTP VERIFICATION: should verify correct OTP and reject wrong/expired ones', async () => {
      // Let's use testEmail1 which is currently unverified
      const user = await prisma.user.findUnique({ where: { email: testEmail1 } });
      
      // In a real scenario OTP is sent via email, but we bypass and simulate finding the raw OTP
      // For this test, we can force the OTP token to a known hash so we can verify it
      const otp = '123456';
      const otpHash = await bcrypt.hash(otp, 10);
      
      await prisma.user.update({
        where: { email: testEmail1 },
        data: { 
          emailVerificationToken: otpHash,
          emailVerificationExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
        }
      });

      // Wrong OTP
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ email: testEmail1, otp: '000000' })
        .expect(401);

      // Correct OTP
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ email: testEmail1, otp })
        .expect(200);

      expect(res.body.access_token).toBeDefined();

      const verifiedUser = await prisma.user.findUnique({ where: { email: testEmail1 } });
      expect(verifiedUser.emailVerified).toBe(true);
      expect(verifiedUser.accountStatus).toBe(AccountStatus.ACTIVE);
      
      // Expired OTP (Let's use a new user for expired test)
      const expiredUserEmail = 'expired@example.com';
      await request(app.getHttpServer())
        .post('/api/v1/auth/register/student')
        .send({ email: expiredUserEmail, password, firstName: 'Exp', lastName: 'User', turnstileToken })
        .expect(201);
        
      await prisma.user.update({
        where: { email: expiredUserEmail },
        data: { 
          emailVerificationToken: otpHash,
          emailVerificationExpiresAt: new Date(Date.now() - 10000) // Expired
        }
      });
      
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ email: expiredUserEmail, otp })
        .expect(401);
        
      await prisma.user.delete({ where: { email: expiredUserEmail } });
    });

    it('5. IDEMPOTENCY: should handle repeated signup requests cleanly', async () => {
      // Repeat 3 times
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register/student')
          .send({
            email: testEmail4,
            password,
            firstName: 'Idemp',
            lastName: 'Student',
            turnstileToken,
          })
          .expect(201);
      }

      const count = await prisma.user.count({ where: { email: testEmail4 } });
      expect(count).toBe(1); // Only 1 record

      const user = await prisma.user.findUnique({ where: { email: testEmail4 } });
      expect(user.emailVerified).toBe(false);
      expect(user.emailOtpAttempts).toBe(0);
    });

    it('6. REGRESSION: Existing verified login works', async () => {
      // testEmail3 was verified earlier
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testEmail3,
          password,
        })
        .expect(200);
        
      expect(res.body.access_token).toBeDefined();
    });
  });

  describe('Provider Signup Flow Regression', () => {
    const providerEmail = 'providerreg@example.com';
    const password = 'Password123!';
    const turnstileToken = 'dummy-token';

    beforeAll(async () => {
      await prisma.orgStaff.deleteMany({ where: { user: { email: providerEmail } } });
      await prisma.session.deleteMany({ where: { user: { email: providerEmail } } });
      await prisma.user.deleteMany({ where: { email: providerEmail } });
      await prisma.organization.deleteMany({ where: { name: 'Regression Provider Org' } });
      await prisma.organization.deleteMany({ where: { name: 'Updated Provider Org' } });
    });

    it('should register a provider successfully and handle idempotency', async () => {
      // 1st signup
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: providerEmail,
          password,
          firstName: 'Prov',
          lastName: 'Ider',
          organizationName: 'Regression Provider Org',
          organizationType: 'PROVIDER',
          turnstileToken,
        })
        .expect(201);

      let user = await prisma.user.findUnique({ where: { email: providerEmail }, include: { orgStaffRoles: { include: { organization: true } } } });
      const allOrgStaff = await prisma.orgStaff.findMany({ where: { userId: user.id } });
      console.log('USER IS:', JSON.stringify(user, null, 2));
      console.log('ALL ORG STAFF FOR USER:', JSON.stringify(allOrgStaff, null, 2));
      expect(user.emailVerified).toBe(false);
      expect(user.orgStaffRoles.length).toBe(1);
      
      const orgId = user.orgStaffRoles[0].organizationId;

      // 2nd signup (unverified idempotency)
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: providerEmail,
          password,
          firstName: 'Prov Updated',
          lastName: 'Ider',
          organizationName: 'Updated Provider Org',
          organizationType: 'PROVIDER',
          turnstileToken,
        })
        .expect(201);

      user = await prisma.user.findUnique({ where: { email: providerEmail }, include: { orgStaffRoles: { include: { organization: true } } } });
      expect(user.firstName).toBe('Prov Updated');
      expect(user.orgStaffRoles.length).toBe(1);
      // Ensure the same org was updated
      expect(user.orgStaffRoles[0].organizationId).toBe(orgId);
      expect(user.orgStaffRoles[0].organization.name).toBe('Updated Provider Org');

      // Verify the provider
      await prisma.user.update({
        where: { email: providerEmail },
        data: { emailVerified: true, accountStatus: AccountStatus.ACTIVE },
      });

      // 3rd signup (verified conflict)
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: providerEmail,
          password,
          firstName: 'Prov',
          lastName: 'Ider',
          organizationName: 'Regression Provider Org',
          organizationType: 'PROVIDER',
          turnstileToken,
        })
        .expect(409);
    });
    
    afterAll(async () => {
      await prisma.orgStaff.deleteMany({ where: { user: { email: providerEmail } } });
      await prisma.session.deleteMany({ where: { user: { email: providerEmail } } });
      await prisma.user.deleteMany({ where: { email: providerEmail } });
      await prisma.organization.deleteMany({ where: { name: 'Updated Provider Org' } });
    });
  });
});
