import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('\n--- SETUP: CLEANUP ---');
  await prisma.savedProperty.deleteMany({});
  await prisma.enquiry.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.property.deleteMany({ where: { name: 'E2E Test Property 6E' } });

  console.log('\n--- SETUP: TOKENS ---');
  
  // 1. Student
  const studentEmail = `student_6e_${Date.now()}@example.com`;
  const stuReg = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, password: 'SecurePassword123!', firstName: 'Stu', lastName: 'Dent', organizationName: 'None', organizationType: 'AGENCY' })
  });
  if (!stuReg.ok) console.log('Student Reg Failed:', await stuReg.text());
  
  const studentToken = await (await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: studentEmail, password: 'SecurePassword123!' })
  })).json().then((r: any) => r.access_token);
  await prisma.user.update({ where: { email: studentEmail }, data: { role: 'STUDENT' }});

  // 2. Hacker Student
  const hackerEmail = `hacker_6e_${Date.now()}@example.com`;
  const hacReg = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: hackerEmail, password: 'SecurePassword123!', firstName: 'Hac', lastName: 'Ker', organizationName: 'None', organizationType: 'AGENCY' })
  });
  if (!hacReg.ok) console.log('Hacker Reg Failed:', await hacReg.text());

  const hackerToken = await (await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: hackerEmail, password: 'SecurePassword123!' })
  })).json().then((r: any) => r.access_token);
  await prisma.user.update({ where: { email: hackerEmail }, data: { role: 'STUDENT' }});
  const hackerId = await prisma.user.findUnique({ where: { email: hackerEmail } }).then((u: any) => u!.id);

  // 3. Provider
  const providerEmail = `provider_6e_${Date.now()}@example.com`;
  const provReg = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: providerEmail, password: 'SecurePassword123!', firstName: 'Prov', lastName: 'Ider', organizationName: 'Org 6E', organizationType: 'PROVIDER' })
  });
  if (!provReg.ok) console.log('Provider Reg Failed:', await provReg.text());

  const providerToken = await (await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: providerEmail, password: 'SecurePassword123!' })
  })).json().then((r: any) => r.access_token);

  const org = await prisma.user.findUnique({ where: { email: providerEmail }, include: { orgStaffRoles: true }});
  const orgId = org!.orgStaffRoles[0].organizationId;

  // Create PUBLISHED Property
  const prop = await prisma.property.create({
    data: {
      name: 'E2E Test Property 6E',
      address: '123 Test St',
      postcode: '3000',
      lat: -37.8,
      lng: 144.9,
      suburbId: (await prisma.suburb.findFirst())!.id,
      description: 'Test',
      organizationId: orgId,
      status: 'PUBLISHED',
      media: { create: { url: 'http://test.com/img.png', type: 'IMAGE', displayOrder: 1 } },
      roomTypes: {
        create: [
          { name: 'Standard Room', pricePerWeek: 45000, inventory: 5, description: 'Standard' },
          { name: 'Sold Out Room', pricePerWeek: 55000, inventory: 0, description: 'Sold Out' }
        ]
      }
    },
    include: { roomTypes: true }
  });

  const standardRoomId = prop.roomTypes.find((r: any) => r.name === 'Standard Room')!.id;
  const soldOutRoomId = prop.roomTypes.find((r: any) => r.name === 'Sold Out Room')!.id;

  // Create DRAFT Property
  const draftProp = await prisma.property.create({
    data: {
      name: 'E2E Draft 6E',
      address: '456 Draft St',
      postcode: '3000',
      lat: -37.8,
      lng: 144.9,
      suburbId: (await prisma.suburb.findFirst())!.id,
      description: 'Draft',
      organizationId: orgId,
      status: 'DRAFT',
    }
  });


  // --- A. ANONYMOUS BOUNDS ---
  console.log('\n--- A: ANONYMOUS ACCESS ---');
  let res = await fetch(`${API_URL}/properties/${prop.id}/save`, { method: 'POST' });
  console.log('Save Status:', res.status); // 401
  res = await fetch(`${API_URL}/properties/${prop.id}/enquiries`, { method: 'POST', body: JSON.stringify({ message: 'Hi' }) });
  console.log('Enquiry Status:', res.status); // 401
  res = await fetch(`${API_URL}/applications`, { method: 'POST', body: JSON.stringify({ propertyId: prop.id, roomTypeId: standardRoomId, moveInDate: '2026-09-01', durationMonths: 6 }) });
  console.log('Application Status:', res.status); // 401

  // --- B. STUDENT SAVE PUBLISHED ---
  console.log('\n--- B: STUDENT SAVE PUBLISHED ---');
  res = await fetch(`${API_URL}/properties/${prop.id}/save`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}` } 
  });
  console.log('Status:', res.status); // 201

  // --- C. STUDENT SAVE DRAFT ---
  console.log('\n--- C: STUDENT SAVE DRAFT ---');
  res = await fetch(`${API_URL}/properties/${draftProp.id}/save`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}` } 
  });
  console.log('Status:', res.status); // 404/400

  // --- D. DUPLICATE SAVE ---
  console.log('\n--- D: DUPLICATE SAVE ---');
  res = await fetch(`${API_URL}/properties/${prop.id}/save`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}` } 
  });
  console.log('Status:', res.status); // 201 (idempotent)

  // --- E. STUDENT UNSAVE ---
  console.log('\n--- E: STUDENT UNSAVE ---');
  res = await fetch(`${API_URL}/properties/${prop.id}/save`, { 
    method: 'DELETE', 
    headers: { 'Authorization': `Bearer ${studentToken}` } 
  });
  console.log('Status:', res.status); // 200

  // --- G. STUDENT ENQUIRY PUBLISHED ---
  console.log('\n--- G: STUDENT ENQUIRY PUBLISHED ---');
  res = await fetch(`${API_URL}/properties/${prop.id}/enquiries`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Is this available?' })
  });
  console.log('Status:', res.status); // 201
  
  // --- H. ENQUIRY DRAFT ---
  console.log('\n--- H: ENQUIRY DRAFT ---');
  res = await fetch(`${API_URL}/properties/${draftProp.id}/enquiries`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Is this available?' })
  });
  console.log('Status:', res.status); // 400

  // --- J. STUDENT APPLICATION ---
  console.log('\n--- J: STUDENT APPLICATION ---');
  res = await fetch(`${API_URL}/applications`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: prop.id, roomTypeId: standardRoomId, moveInDate: '2026-09-01', durationMonths: 6, lockedPrice: 1000 })
  });
  console.log('Status:', res.status); // 201

  // --- K. CROSS USER APPLICATION ATTACK ---
  console.log('\n--- K: CROSS USER APPLICATION (HACKER) ---');
  res = await fetch(`${API_URL}/applications`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
    // Attempting to apply on behalf of Hacker
    body: JSON.stringify({ propertyId: prop.id, roomTypeId: standardRoomId, moveInDate: '2026-09-01', durationMonths: 6, studentId: hackerId })
  });
  console.log('Status:', res.status); // 201 (But it should create it for the JWT student, not the hacker)

  const hackerApps = await prisma.application.findMany({ where: { studentId: hackerId } });
  console.log('Hacker Applications Count:', hackerApps.length); // Should be 0

  // --- M. STUDENT APPLIES TO SOLD OUT ROOM ---
  console.log('\n--- M: STUDENT APPLIES TO UNAVAILABLE ROOM ---');
  res = await fetch(`${API_URL}/applications`, { 
    method: 'POST', 
    headers: { 'Authorization': `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ propertyId: prop.id, roomTypeId: soldOutRoomId, moveInDate: '2026-09-01', durationMonths: 6 })
  });
  console.log('Status:', res.status); // 400

  // --- N. VERIFY LOCKED PRICE (Ignoring frontend input) ---
  console.log('\n--- N: VERIFY LOCKED PRICE ---');
  const myApp = await prisma.application.findFirst({ where: { roomTypeId: standardRoomId } });
  console.log('Locked Price:', myApp?.lockedPrice); // Should be 45000 (not 1000)

  console.log('\n--- ALL TESTS COMPLETE ---');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
