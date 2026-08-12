const API_URL = 'http://localhost:3001/api/v1';

async function runTests() {
  console.log('--- SETUP: GETTING TOKENS ---');
  
  // Login as provider from Phase 6A (test_provider) or create a new one
  const email = `test_provider_${Date.now()}@example.com`;
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'Provider',
      organizationName: 'Phase 6B Org',
      organizationType: 'PROVIDER',
    })
  });
  const provider1 = await regRes.json();
  const token1 = provider1.access_token;
  const org1 = provider1.user.organizationId;
  console.log('Provider 1 registered');

  const email2 = `test_provider2_${Date.now()}@example.com`;
  const regRes2 = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email2,
      password: 'SecurePassword123!',
      firstName: 'Test2',
      lastName: 'Provider2',
      organizationName: 'Phase 6B Org 2',
      organizationType: 'PROVIDER',
    })
  });
  const provider2 = await regRes2.json();
  const token2 = provider2.access_token;
  console.log('Provider 2 registered');

  // Fetch suburbs to use a valid one
  const suburbsRes = await fetch(`${API_URL}/locations/suburbs`);
  const suburbs = await suburbsRes.json();
  const testSuburbId = suburbs[0]?.id;
  if (!testSuburbId) throw new Error("No suburbs found");

  console.log('\n--- A: UNAUTHENTICATED CREATE ---');
  const noAuthCreate = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test' })
  });
  console.log('Status:', noAuthCreate.status);

  // Note: Since we don't have a specific student signup endpoint easily callable without bypassing OrgStaff creation (which registerProvider does), I'll skip B programmatically and focus on the rest.

  console.log('\n--- C: PROVIDER CREATE ---');
  const validCreate = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    },
    body: JSON.stringify({
      name: 'My Test Accommodation',
      address: '123 Fake Street',
      suburbId: testSuburbId,
      postcode: '3000',
      lat: -37.8,
      lng: 144.9,
      description: 'Test desc'
    })
  });
  const createdProp = await validCreate.json();
  console.log('Status:', validCreate.status, 'Response:', createdProp);

  console.log('\n--- D: PROVIDER LIST ---');
  const listProps = await fetch(`${API_URL}/properties/my`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  const myProps = await listProps.json();
  console.log('Status:', listProps.status, 'My Props Response:', myProps);

  console.log('\n--- E: CROSS-ORGANIZATION ACCESS ---');
  const crossAccess = await fetch(`${API_URL}/properties/my/${createdProp.id}`, {
    headers: { 'Authorization': `Bearer ${token2}` }
  });
  console.log('Provider 2 accessing Provider 1 prop -> Status:', crossAccess.status);

  console.log('\n--- F: ORGANIZATION ID MANIPULATION ---');
  // Attempt to pass organizationId in body to override
  const manipCreate = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    },
    body: JSON.stringify({
      name: 'Manipulated Prop',
      address: '123 Fake Street',
      suburbId: testSuburbId,
      postcode: '3000',
      lat: -37.8,
      lng: 144.9,
      description: 'Test desc',
      organizationId: 'fake-org-id-123'
    })
  });
  const manipProp = await manipCreate.json();
  // It shouldn't use the fake one, it should use token1's org.
  console.log('Created Org ID:', manipProp.organizationId, 'Expected Org ID:', org1, 'Matches:', manipProp.organizationId === org1);

  console.log('\n--- G: INVALID COORDINATES ---');
  const badCoords = await fetch(`${API_URL}/properties`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    },
    body: JSON.stringify({
      name: 'Bad Coords Prop',
      address: '123 Fake Street',
      suburbId: testSuburbId,
      postcode: '3000',
      lat: 100, // Invalid lat
      lng: 144.9,
      description: 'Test desc'
    })
  });
  console.log('Status:', badCoords.status);

  console.log('\n--- H: SEARCH REGRESSION ---');
  const searchRes = await fetch(`${API_URL}/properties/search`);
  const searchJson = await searchRes.json();
  // Check if createdProp.id is in search results
  const found = searchJson.data.some((p) => p.id === createdProp.id);
  console.log('Draft property found in search results?', found);
}

runTests().catch(console.error);
