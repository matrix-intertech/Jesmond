import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('\n--- SETUP: CLEANUP ---');
  await prisma.lease.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.property.deleteMany({ where: { name: 'E2E Property 6F' } });

  console.log('\n--- SETUP: TOKENS ---');
  // 1. Student A
  const studentA = `student_a_6f_${Date.now()}@example.com`;
  await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: studentA, password: 'SecurePassword123!', firstName: 'A', lastName: 'Student', organizationName: 'None', organizationType: 'AGENCY' }) });
  const tokenA = await (await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: studentA, password: 'SecurePassword123!' }) })).json().then((r: any) => r.access_token);
  await prisma.user.update({ where: { email: studentA }, data: { role: 'STUDENT' }});

  // 2. Student B
  const studentB = `student_b_6f_${Date.now()}@example.com`;
  await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: studentB, password: 'SecurePassword123!', firstName: 'B', lastName: 'Student', organizationName: 'None', organizationType: 'AGENCY' }) });
  await prisma.user.update({ where: { email: studentB }, data: { role: 'STUDENT' }});

  // 3. Provider
  const provider = `provider_6f_${Date.now()}@example.com`;
  await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: provider, password: 'SecurePassword123!', firstName: 'P', lastName: 'Rovider', organizationName: 'Org 6F', organizationType: 'PROVIDER' }) });
  const tokenProvider = await (await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: provider, password: 'SecurePassword123!' }) })).json().then((r: any) => r.access_token);
  const org = await prisma.user.findUnique({ where: { email: provider }, include: { orgStaffRoles: true }});
  const orgId = org!.orgStaffRoles[0].organizationId;

  // 4. Property with Inventory = 1
  const prop = await prisma.property.create({
    data: {
      name: 'E2E Property 6F', address: '6F Street', postcode: '3000', lat: -37.8, lng: 144.9, suburbId: (await prisma.suburb.findFirst())!.id, description: 'Test', organizationId: orgId, status: 'PUBLISHED',
      roomTypes: { create: [{ name: 'Last Room', pricePerWeek: 45000, inventory: 1, description: 'Only 1 left' }] }
    },
    include: { roomTypes: true }
  });
  const roomId = prop.roomTypes[0].id;

  // 5. Create Applications
  const appA = await (await fetch(`${API_URL}/applications`, { method: 'POST', headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: prop.id, roomTypeId: roomId, moveInDate: '2026-09-01', durationMonths: 6 }) })).json();
  // We need token for Student B to create Application B
  const tokenB = await (await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: studentB, password: 'SecurePassword123!' }) })).json().then((r: any) => r.access_token);
  const appB = await (await fetch(`${API_URL}/applications`, { method: 'POST', headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: prop.id, roomTypeId: roomId, moveInDate: '2026-09-01', durationMonths: 6 }) })).json();


  // --- TESTS ---

  console.log('\n--- A: ANONYMOUS BOUNDARY ---');
  let res = await fetch(`${API_URL}/applications/provider/${appA.id}`);
  console.log('Status:', res.status); // 401

  console.log('\n--- B: STUDENT ON PROVIDER ENDPOINT ---');
  res = await fetch(`${API_URL}/applications/provider/${appA.id}`, { headers: { 'Authorization': `Bearer ${tokenA}` }});
  console.log('Status:', res.status); // 403

  console.log('\n--- C: PROVIDER VIEWS OWN APPLICATION ---');
  res = await fetch(`${API_URL}/applications/provider/${appA.id}`, { headers: { 'Authorization': `Bearer ${tokenProvider}` }});
  console.log('Status:', res.status); // 200

  console.log('\n--- D: PRICE UPDATE DOES NOT AFFECT APP LOCKED PRICE ---');
  await prisma.roomType.update({ where: { id: roomId }, data: { pricePerWeek: 99999 } });
  const checkAppA = await prisma.application.findUnique({ where: { id: appA.id } });
  console.log('Original Locked Price (App A):', checkAppA?.lockedPrice); // 45000
  console.log('New Room Price:', 99999);

  console.log('\n--- E: CONCURRENCY TEST (APPROVAL) ---');
  console.log('Attempting to approve both Application A and Application B exactly simultaneously...');
  
  const [resAppA, resAppB] = await Promise.all([
    fetch(`${API_URL}/applications/${appA.id}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${tokenProvider}` }}),
    fetch(`${API_URL}/applications/${appB.id}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${tokenProvider}` }})
  ]);

  console.log('App A Approval Status:', resAppA.status);
  console.log('App B Approval Status:', resAppB.status);
  
  const bodyA = await resAppA.json().catch(() => ({}));
  const bodyB = await resAppB.json().catch(() => ({}));
  
  if (resAppA.status === 201 && resAppB.status === 201) {
    console.error('CONCURRENCY FAIL: Both applications approved!');
  } else if ((resAppA.status === 201 && resAppB.status === 400) || (resAppA.status === 400 && resAppB.status === 201)) {
    console.log('CONCURRENCY PASS: Exactly one application succeeded. The other was rejected due to inventory constraint.');
  } else {
    console.log('Unexpected state. App A body:', bodyA, 'App B body:', bodyB);
  }

  const finalRoom = await prisma.roomType.findUnique({ where: { id: roomId } });
  console.log('Final Inventory:', finalRoom?.inventory); // Should be 0

  const leases = await prisma.lease.findMany({ where: { application: { roomTypeId: roomId } } });
  console.log('Leases Created:', leases.length); // Should be 1

  console.log('\n--- ALL TESTS COMPLETE ---');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
