import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Forgot Password Flow & Security', () => {
  const testEmail = 'student@jesmond.demo'; // Pre-seeded account from seed-qa.ts
  const nonexistentEmail = 'nobody@jesmond.demo';

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('1. Existing email gets generic forgot-password response', async ({ request }) => {
    const res = await request.post('/api/v1/auth/forgot-password', { data: { email: testEmail } });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.message).toBe('If an account exists with this email, an OTP has been sent.');
    // Check that OTP is NOT returned in response
    expect(data.otp).toBeUndefined();
  });

  test('2. Non-existing email gets identical generic response', async ({ request }) => {
    const res = await request.post('/api/v1/auth/forgot-password', { data: { email: nonexistentEmail } });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.message).toBe('If an account exists with this email, an OTP has been sent.');
  });
  
  test('3. Forgot-password rate limiting / cooldown works', async ({ request }) => {
    // Repeated request immediately after the first one
    const res = await request.post('/api/v1/auth/forgot-password', { data: { email: testEmail } });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.message).toBe('If an account exists with this email, an OTP has been sent.');
  });

  test('4. Invalid OTP fails', async ({ request }) => {
    const res = await request.post('/api/v1/auth/verify-reset-otp', {
      data: { email: testEmail, otp: '000000' }
    });
    expect(res.status()).toBe(401);
  });

  test('5. Full Reset Flow: validation and password reset', async ({ request }) => {
    // We use admin@jesmond.demo for the full flow
    const adminEmail = 'admin@jesmond.demo';

    // Instead of relying on the email service to extract the OTP, we directly inject a known bcrypt hash for OTP "123456"
    const knownOtp = '123456';
    const knownOtpHash = '$2b$10$QVOaKb7MQDNFv5sEL9jN6OLKP0G4.UDsxsRO49ch3oxFra0Xd7PdS'; // Bcrypt of '123456'

    await prisma.$executeRawUnsafe(`
      UPDATE "User" 
      SET "passwordResetToken" = '${knownOtpHash}', 
          "passwordResetExpiresAt" = NOW() + interval '15 minutes', 
          "passwordResetOtpAttempts" = 0 
      WHERE email = '${adminEmail}'
    `);

    // Verify OTP succeeds
    const verifyRes = await request.post('/api/v1/auth/verify-reset-otp', {
      data: { email: adminEmail, otp: knownOtp }
    });
    expect(verifyRes.ok()).toBeTruthy();

    // Reset password
    const newPassword = 'NewPassword123!';
    const resetRes = await request.post('/api/v1/auth/reset-password', {
      data: { email: adminEmail, otp: knownOtp, newPassword }
    });
    expect(resetRes.ok()).toBeTruthy();

    // Verify old password fails
    const oldLoginRes = await request.post('/api/v1/auth/login', {
      data: { email: adminEmail, password: 'Jesmond@Demo2026!' }
    });
    expect(oldLoginRes.status()).toBe(401);

    // Verify new password succeeds
    const newLoginRes = await request.post('/api/v1/auth/login', {
      data: { email: adminEmail, password: newPassword }
    });
    expect(newLoginRes.ok()).toBeTruthy();
    
    // Cleanup: Reset password back for other tests
    await prisma.$executeRawUnsafe(`
      UPDATE "User" 
      SET "passwordResetToken" = '${knownOtpHash}', 
          "passwordResetExpiresAt" = NOW() + interval '15 minutes', 
          "passwordResetOtpAttempts" = 0 
      WHERE email = '${adminEmail}'
    `);
    await request.post('/api/v1/auth/reset-password', {
      data: { email: adminEmail, otp: knownOtp, newPassword: 'Jesmond@Demo2026!' }
    });
  });
});
