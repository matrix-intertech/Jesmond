import { readFileSync } from 'fs';
const API_URL = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('--- SETUP: GETTING TOKENS & CREATING PROPERTY ---');
  
  const email = `test_provider_6c_${Date.now()}@example.com`;
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'Provider 6C',
      organizationName: 'Phase 6C Org',
      organizationType: 'PROVIDER',
    })
  });
  const provider1 = await regRes.json();
  const token1 = provider1.access_token;
  const org1 = provider1.user.organizationId;

  const email2 = `test_provider2_6c_${Date.now()}@example.com`;
  const regRes2 = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email2,
      password: 'SecurePassword123!',
      firstName: 'Test2',
      lastName: 'Provider2 6C',
      organizationName: 'Phase 6C Org 2',
      organizationType: 'PROVIDER',
    })
  });
  const provider2 = await regRes2.json();
  const token2 = provider2.access_token;

  // Fetch suburbs
  const suburbsRes = await fetch(`${API_URL}/locations/suburbs`);
  const suburbs = await suburbsRes.json();
  const testSuburbId = suburbs[0]?.id;

  // Create property
  const propRes = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    },
    body: JSON.stringify({
      name: 'Phase 6C Test Accommodation',
      address: '123 Fake Street',
      suburbId: testSuburbId,
      postcode: '3000',
      lat: -37.8,
      lng: 144.9,
      description: 'Test desc'
    })
  });
  const property = await propRes.json();
  const propId = property.id;
  console.log('Property created:', propId);

  // A: unauthenticated image upload -> 401
  console.log('\n--- A: UNAUTHENTICATED IMAGE UPLOAD ---');
  // We'll just do a POST without body for 401 check
  let res = await fetch(`${API_URL}/properties/my/${propId}/media`, { method: 'POST' });
  console.log('Status:', res.status);

  // B: student image upload -> skipping explicit student due to register limits, same as 6B.

  // C: provider uploads to own property -> should hit 503 because S3 isn't mocked (or 500)
  console.log('\n--- C: PROVIDER UPLOAD OWN PROPERTY ---');
  // Since we aren't using form-data node library, let's just send empty to see it hit 400 No file provided
  res = await fetch(`${API_URL}/properties/my/${propId}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  console.log('Status:', res.status); // Expect 400 No file

  // D: provider uploads to another provider's property
  console.log('\n--- D: PROVIDER 2 UPLOAD PROVIDER 1 PROPERTY ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token2}` }
  });
  console.log('Status:', res.status); // Expect 403

  // E: modify another org's room -> we use POST room for provider 2 on provider 1 prop
  console.log('\n--- E: CROSS-ORGANIZATION ROOM CREATION ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token2}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Studio', pricePerWeek: 45000, inventory: 10 })
  });
  console.log('Status:', res.status); // Expect 403

  // E2: Provider 1 creates room
  console.log('\n--- PROVIDER 1 CREATE ROOM ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Valid Studio', pricePerWeek: 45000, inventory: 10 })
  });
  const room = await res.json();
  console.log('Status:', res.status, 'Response:', room);

  // F: cross org availability
  console.log('\n--- F: CROSS-ORGANIZATION AVAILABILITY ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms/${room.id}/availability`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token2}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2027-01-01', available: 5 })
  });
  console.log('Status:', res.status); // Expect 403

  // G: negative price
  console.log('\n--- G: NEGATIVE PRICE ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Studio', pricePerWeek: -100, inventory: 10 })
  });
  console.log('Status:', res.status); // Expect 400

  // H: negative inventory
  console.log('\n--- H: NEGATIVE INVENTORY ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bad Studio 2', pricePerWeek: 45000, inventory: -5 })
  });
  console.log('Status:', res.status); // Expect 400

  // I: availability > inventory
  console.log('\n--- I: AVAILABILITY > INVENTORY ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms/${room.id}/availability`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2027-01-01', available: 15 }) // Inventory is 10
  });
  console.log('Status:', res.status); // Expect 400

  // Valid availability
  console.log('\n--- VALID AVAILABILITY ---');
  res = await fetch(`${API_URL}/properties/my/${propId}/rooms/${room.id}/availability`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: '2027-01-01', available: 5 })
  });
  console.log('Status:', res.status); // Expect 200/201

  // Regression
  console.log('\n--- REGRESSION: SEARCH VISIBILITY ---');
  const searchRes = await fetch(`${API_URL}/properties/search`);
  const searchJson = await searchRes.json();
  const found = searchJson.data.some((p) => p.id === propId);
  console.log('Draft property found in search results?', found);
}

runTests().catch(console.error);
