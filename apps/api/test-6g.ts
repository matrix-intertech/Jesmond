import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('\n--- SETUP: TOKENS ---');
  // Student
  const studentEmail = `student_6g_${Date.now()}@example.com`;
  await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: studentEmail, password: 'SecurePassword123!', firstName: 'S', lastName: 'Tudent', organizationName: 'None', organizationType: 'AGENCY' }) });
  const studentToken = await (await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: studentEmail, password: 'SecurePassword123!' }) })).json().then((r: any) => r.access_token);
  await prisma.user.update({ where: { email: studentEmail }, data: { role: 'STUDENT' }});

  // Provider / Org Staff
  const providerEmail = `provider_6g_${Date.now()}@example.com`;
  await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: providerEmail, password: 'SecurePassword123!', firstName: 'P', lastName: 'Rovider', organizationName: 'Org 6G', organizationType: 'PROVIDER' }) });
  const providerToken = await (await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: providerEmail, password: 'SecurePassword123!' }) })).json().then((r: any) => r.access_token);
  await prisma.user.update({ where: { email: providerEmail }, data: { role: 'ORG_STAFF' }});

  // Admin
  const adminEmail = `admin_6g_${Date.now()}@example.com`;
  await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: 'SecurePassword123!', firstName: 'A', lastName: 'Dmin', organizationName: 'Admin', organizationType: 'AGENCY' }) });
  const adminToken = await (await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: adminEmail, password: 'SecurePassword123!' }) })).json().then((r: any) => r.access_token);
  await prisma.user.update({ where: { email: adminEmail }, data: { role: 'ADMIN' }});

  // Super Admin
  const superAdminEmail = `superadmin_6g_${Date.now()}@example.com`;
  await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: superAdminEmail, password: 'SecurePassword123!', firstName: 'S', lastName: 'Admin', organizationName: 'SAdmin', organizationType: 'AGENCY' }) });
  const superAdminToken = await (await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: superAdminEmail, password: 'SecurePassword123!' }) })).json().then((r: any) => r.access_token);
  await prisma.user.update({ where: { email: superAdminEmail }, data: { role: 'SUPER_ADMIN' }});


  console.log('\n--- 1. DEFAULT STATUS MUST BE DISABLED ---');
  let res = await fetch(`${API_URL}/payments/status`);
  let data = await res.json();
  console.log('Payments Enabled:', data.enabled); // false

  console.log('\n--- 2. UNAUTHORIZED TOGGLE ATTEMPTS ---');
  res = await fetch(`${API_URL}/admin/features/PAYMENTS_BOOKING`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  console.log('Anonymous:', res.status); // 401

  res = await fetch(`${API_URL}/admin/features/PAYMENTS_BOOKING`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${studentToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  console.log('Student:', res.status); // 403

  res = await fetch(`${API_URL}/admin/features/PAYMENTS_BOOKING`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${providerToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  console.log('Provider:', res.status); // 403

  res = await fetch(`${API_URL}/admin/features/PAYMENTS_BOOKING`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  console.log('Admin:', res.status); // 403


  console.log('\n--- 3. PAYMENT CREATION (DISABLED) ---');
  res = await fetch(`${API_URL}/payments/create-checkout`, { method: 'POST', headers: { 'Authorization': `Bearer ${studentToken}` } });
  console.log('Create Checkout Status:', res.status); // 403

  console.log('\n--- 4. SUPER ADMIN ENABLE ---');
  res = await fetch(`${API_URL}/admin/features/PAYMENTS_BOOKING`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  console.log('Enable Status:', res.status); // 200

  res = await fetch(`${API_URL}/payments/status`);
  data = await res.json();
  console.log('Payments Enabled:', data.enabled); // true


  console.log('\n--- 5. PAYMENT CREATION (ENABLED) ---');
  res = await fetch(`${API_URL}/payments/create-checkout`, { method: 'POST', headers: { 'Authorization': `Bearer ${studentToken}` } });
  console.log('Create Checkout Status:', res.status); // 201


  console.log('\n--- 6. SUPER ADMIN DISABLE ---');
  res = await fetch(`${API_URL}/admin/features/PAYMENTS_BOOKING`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
  console.log('Disable Status:', res.status); // 200


  console.log('\n--- 7. AUDIT LOG CHECK ---');
  const logs = await prisma.auditLog.findMany({ where: { resourceType: 'FeatureFlag', resourceId: 'PAYMENTS_BOOKING' } });
  console.log(`Audit Logs Generated: ${logs.length}`);

  console.log('\n--- ALL TESTS COMPLETE ---');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
