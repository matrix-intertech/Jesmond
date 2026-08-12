import { PrismaClient } from '@prisma/client';

const API_URL = 'http://localhost:3001/api/v1';
const prisma = new PrismaClient();

async function runTests() {
  console.log('--- SETUP: TOKENS ---');
  
  // 1. Admin
  const adminEmail = `admin_6d_${Date.now()}@example.com`;
  const adminRegRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'SecurePassword123!', firstName: 'Admin', lastName: 'User', organizationName: 'Admin Org', organizationType: 'AGENCY' })
  });
  if (!adminRegRes.ok) console.log('Admin reg failed:', await adminRegRes.text());
  
  await prisma.user.update({
    where: { email: adminEmail },
    data: { role: 'SUPER_ADMIN' }
  });

  const adminLogin = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: 'SecurePassword123!' })
  });
  const adminToken = (await adminLogin.json()).access_token;

  // 2. Provider 1
  const prov1Res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `prov1_6d_${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Provider',
      lastName: 'One',
      organizationName: 'Org 6D One',
      organizationType: 'PROVIDER',
    })
  });
  const prov1Token = (await prov1Res.json()).access_token;

  // 3. Provider 2
  const prov2Res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `prov2_6d_${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Provider',
      lastName: 'Two',
      organizationName: 'Org 6D Two',
      organizationType: 'PROVIDER',
    })
  });
  const prov2Token = (await prov2Res.json()).access_token;

  // 4. Student
  const stuRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `student_6d_${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Student',
      lastName: 'User'
    })
  });
  const stuToken = (await stuRes.json()).access_token;

  console.log('--- A: PROVIDER CREATES DRAFT ---');
  const suburbs = await (await fetch(`${API_URL}/locations/suburbs`)).json();
  const testSuburbId = suburbs[0]?.id;

  const propRes = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Phase 6D Draft',
      address: '123 Test St',
      suburbId: testSuburbId,
      postcode: '3000',
      lat: -37.8,
      lng: 144.9,
      description: 'Review me'
    })
  });
  const property = await propRes.json();
  const propId = property.id;
  console.log('Property Created (Status):', property.status);

  // E: Student attempts submit -> 403
  console.log('\n--- E: STUDENT ATTEMPTS SUBMIT ---');
  let res = await fetch(`${API_URL}/properties/my/${propId}/submit`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${stuToken}` }
  });
  console.log('Status:', res.status); // 403

  // Provider submits incomplete draft -> 400
  console.log('\n--- PROVIDER SUBMITS INCOMPLETE DRAFT ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/submit`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}` }
  });
  console.log('Status:', res.status, 'Body:', await res.json()); // 400

  // Add dummy media (hack to bypass S3 for test, we'll use prisma)
  await prisma.media.create({
    data: {
      propertyId: propId,
      url: 'https://example.com/test.jpg',
      type: 'IMAGE',
      displayOrder: 1
    }
  });

  // Add room type
  await fetch(`${API_URL}/properties/my/${propId}/rooms`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Studio', pricePerWeek: 45000, inventory: 10 })
  });

  // B: Provider submits complete DRAFT
  console.log('\n--- B: PROVIDER SUBMITS COMPLETE DRAFT ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/submit`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}` }
  });
  console.log('Status:', res.status); // 201

  // C: Provider submits already PENDING_APPROVAL
  console.log('\n--- C: PROVIDER SUBMITS ALREADY PENDING ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/submit`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}` }
  });
  console.log('Status:', res.status, 'Body:', await res.json()); // 400

  // D: Provider attempts direct manipulation -> not exposed via API anyway (only submit endpoint exists)
  console.log('\n--- D: PROVIDER DIRECT MANIPULATION (Skipped, no endpoint) ---');

  // G: Student attempts approve
  console.log('\n--- G: STUDENT ATTEMPTS APPROVE ---');
  res = await fetch(`${API_URL}/admin/properties/${propId}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${stuToken}` }
  });
  console.log('Status:', res.status); // 403

  // F: Provider attempts approve
  console.log('\n--- F: PROVIDER ATTEMPTS APPROVE ---');
  res = await fetch(`${API_URL}/admin/properties/${propId}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}` }
  });
  console.log('Status:', res.status); // 403

  // Search Visibility Test before approval
  console.log('\n--- 16. SEARCH VISIBILITY TEST (PENDING) ---');
  let searchRes = await (await fetch(`${API_URL}/properties/search`)).json();
  console.log('In search results?', searchRes.data.some((p: any) => p.id === propId));

  // Property Detail Visibility
  console.log('\n--- 17. PUBLIC DETAIL VISIBILITY (PENDING) ---');
  res = await fetch(`${API_URL}/properties/public/${propId}`);
  console.log('Status:', res.status); // 404

  // Provider Edit Restrictions
  console.log('\n--- 18. PROVIDER EDIT RESTRICTIONS ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hacked', pricePerWeek: 1000, inventory: 1 })
  });
  console.log('Status:', res.status); // 403

  // H: Admin approves PENDING_APPROVAL
  console.log('\n--- H: ADMIN APPROVES PENDING ---');
  res = await fetch(`${API_URL}/admin/properties/${propId}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('Status:', res.status); // 201

  // I: Admin approves already PUBLISHED
  console.log('\n--- I: ADMIN APPROVES ALREADY PUBLISHED ---');
  res = await fetch(`${API_URL}/admin/properties/${propId}/approve`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('Status:', res.status); // 400

  // Search Visibility Test after approval
  console.log('\n--- 16. SEARCH VISIBILITY TEST (PUBLISHED) ---');
  searchRes = await (await fetch(`${API_URL}/properties/search`)).json();
  console.log('In search results?', searchRes.data.some((p: any) => p.id === propId));

  // Property Detail Visibility
  console.log('\n--- 17. PUBLIC DETAIL VISIBILITY (PUBLISHED) ---');
  res = await fetch(`${API_URL}/properties/public/${propId}`);
  console.log('Status:', res.status); // 200

  // J: Admin rejects (Wait, let's create a new property for rejection test)
  console.log('\n--- J: ADMIN REJECTS PENDING ---');
  const p2Res = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${prov1Token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Reject Me', address: '1', suburbId: testSuburbId, postcode: '1', lat: 1, lng: 1, description: '1' })
  });
  const prop2Id = (await p2Res.json()).id;
  await prisma.media.create({ data: { propertyId: prop2Id, url: 'a', type: 'IMAGE', displayOrder: 1 } });
  await prisma.roomType.create({ data: { propertyId: prop2Id, name: 'a', pricePerWeek: 1, inventory: 1 } });
  await fetch(`${API_URL}/properties/my/${prop2Id}/submit`, { method: 'POST', headers: { 'Authorization': `Bearer ${prov1Token}` } });
  
  res = await fetch(`${API_URL}/admin/properties/${prop2Id}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Incomplete images' })
  });
  const rejectedProp = await res.json();
  console.log('Status:', res.status, 'New Property Status:', rejectedProp.status);
  
  // Verify version history captured reason
  const versions = await prisma.propertyVersion.findMany({ where: { propertyId: prop2Id }, orderBy: { versionNum: 'desc' } });
  console.log('Captured Reason:', (versions[0].changes as any).reason);

  console.log('\n--- ALL TESTS COMPLETE ---');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
