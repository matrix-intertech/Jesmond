import { test, expect } from '@playwright/test';

test.describe('Admin Property Verification Isolation', () => {
  test.setTimeout(60000);

  test('admin can update one property verification without affecting another', async ({ request, page }) => {
    // 1. Create a dummy organization and two properties using the backend API directly or seed them
    // For this test, we will just use the API. Wait, doing this via API without a proper token is hard.
    // Let's assume there's a way to get a token or we can just login.
    
    // Login to get token
    const loginRes = await request.post('http://localhost:3001/api/v1/auth/login', {
      data: { email: 'admin@jesmond.demo', password: 'Jesmond@Demo2026!' }
    });
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    
    // Fetch active properties
    const activeRes = await request.get('http://localhost:3001/api/v1/admin/properties/active', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const activeProps = await activeRes.json();
    
    // Find two properties that share the same organization
    // Let's map by organizationId
    const orgMap = new Map<string, any[]>();
    for (const p of activeProps) {
      if (!orgMap.has(p.organizationId)) orgMap.set(p.organizationId, []);
      orgMap.get(p.organizationId)!.push(p);
    }
    
    let targetOrgId: string | null = null;
    let propA: any = null;
    let propB: any = null;
    
    for (const [orgId, props] of orgMap.entries()) {
      if (props.length >= 2) {
        targetOrgId = orgId;
        propA = props[0];
        propB = props[1];
        break;
      }
    }
    
    // If no org with 2 properties, the test cannot be strictly executed this way.
    // We assume the DB has one. If not, we skip the isolation check but we can still check org status.
    expect(propA).toBeDefined();
    expect(propB).toBeDefined();

    const originalOrgStatus = propA.organization.status;

    // Reset both properties to PENDING via API
    await request.post(`http://localhost:3001/api/v1/admin/properties/${propA.id}/verification`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'PENDING' }
    });
    
    await request.post(`http://localhost:3001/api/v1/admin/properties/${propB.id}/verification`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'PENDING' }
    });

    // Set A to VERIFIED
    const updateARes = await request.post(`http://localhost:3001/api/v1/admin/properties/${propA.id}/verification`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'VERIFIED' }
    });
    expect(updateARes.ok()).toBeTruthy();

    // Fetch A and B again
    const fetchA = await request.get(`http://localhost:3001/api/v1/admin/properties/${propA.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dataA = await fetchA.json();
    
    const fetchB = await request.get(`http://localhost:3001/api/v1/admin/properties/${propB.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dataB = await fetchB.json();

    // Verify A = VERIFIED, B = PENDING
    expect(dataA.verificationStatus).toBe('VERIFIED');
    expect(dataB.verificationStatus).toBe('PENDING');

    // Verify Org Status is untouched
    expect(dataA.organization.status).toBe(originalOrgStatus);

    // Change A to REJECTED
    await request.post(`http://localhost:3001/api/v1/admin/properties/${propA.id}/verification`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'REJECTED' }
    });

    // Fetch B again
    const fetchB2 = await request.get(`http://localhost:3001/api/v1/admin/properties/${propB.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dataB2 = await fetchB2.json();

    // Verify B = PENDING
    expect(dataB2.verificationStatus).toBe('PENDING');
    
    // Verify Org Status is untouched
    expect(dataB2.organization.status).toBe(originalOrgStatus);
    
    // Clean up: restore both to VERIFIED if they were published
    await request.post(`http://localhost:3001/api/v1/admin/properties/${propA.id}/verification`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'VERIFIED' }
    });
    await request.post(`http://localhost:3001/api/v1/admin/properties/${propB.id}/verification`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'VERIFIED' }
    });
  });
});
