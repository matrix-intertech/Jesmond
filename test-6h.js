const crypto = require('crypto');

const API_URL = 'http://localhost:3001/api/v1';

async function runTests() {
  let studentEmail = `student.${crypto.randomBytes(4).toString('hex')}@example.com`;
  let studentPassword = 'SecurePassword123!';
  let studentToken = '';
  let providerToken = '';
  let organizationId = '';
  let propertyId = '';
  let roomTypeId = '';
  let applicationId = '';

  console.log('--- Phase 6H E2E Tests ---');

  try {
    // 1. Find a published property with available rooms
    const searchRes = await fetch(`${API_URL}/properties/search`);
    const searchData = await searchRes.json();
    let publishedProps = searchData.data;
    
    // We need a provider login to approve the application later.
    const provEmail = `prov.${crypto.randomBytes(4).toString('hex')}@test.com`;
    await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: provEmail,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Provider',
        organizationName: 'Test Org',
        organizationType: 'PROVIDER'
      })
    });

    const provLogin = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: provEmail, password: 'Password123!' })
    });
    const provLoginData = await provLogin.json();
    providerToken = provLoginData.access_token;
    organizationId = provLoginData.user.organizationId;

    if (publishedProps.length === 0) {
      console.log('No published properties found. Creating one...');
      // Create Property
      const propCreateRes = await fetch(`${API_URL}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}` },
        body: JSON.stringify({
          name: 'Test E2E Property',
          description: 'Testing',
          address: '123 Test St',
          suburbId: 'suburb_melbourne_cbd', 
        })
      });
      
      if(!propCreateRes.ok) {
          const suburbs = await (await fetch(`${API_URL}/locations/suburbs`)).json();
          const subId = suburbs[0].id;
          const pRes = await fetch(`${API_URL}/properties`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}` },
            body: JSON.stringify({
              name: 'Test E2E Property',
              description: 'Testing',
              address: '123 Test St',
              suburbId: subId
            })
          });
          propertyId = (await pRes.json()).id;
      } else {
          propertyId = (await propCreateRes.json()).id;
      }

      // Add Room Type
      const roomRes = await fetch(`${API_URL}/properties/my/${propertyId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}` },
        body: JSON.stringify({
          name: 'Test Room',
          description: 'Test Room Desc',
          pricePerWeek: 45000,
          inventory: 5,
          type: 'PRIVATE'
        })
      });
      roomTypeId = (await roomRes.json()).id;

      // Submit for review
      await fetch(`${API_URL}/properties/my/${propertyId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${providerToken}` }
      });

      // Admin Approve Property 
      let adminTok = '';
      const adminLogin = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@jesmond.test', password: 'AdminPassword123!' })
      });
      if (adminLogin.ok) {
          adminTok = (await adminLogin.json()).access_token;
      } else {
          const ad2 = await fetch(`${API_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: 'admin@jesmond.test', password: 'Password123!' })
          });
          if(ad2.ok) adminTok = (await ad2.json()).access_token;
      }

      if (adminTok) {
        await fetch(`${API_URL}/admin/properties/${propertyId}/approve`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminTok}` }
        });
      } else {
         console.warn('Could not approve property. Tests might fail.');
      }
    } else {
      const prop = publishedProps[0];
      propertyId = prop.id;

      // Get Property Detail to find a valid room
      const propDetailRes = await fetch(`${API_URL}/properties/public/${propertyId}`);
      const propDetail = await propDetailRes.json();
      const availableRooms = propDetail.roomTypes.filter(r => r.inventory > 0);
      if (availableRooms.length === 0) {
        throw new Error(`Property ${propertyId} has no available rooms.`);
      }
      roomTypeId = availableRooms[0].id;
    }

    console.log('Setup complete. Property:', propertyId, 'Room:', roomTypeId);

    // 1. Student Registration
    const regRes = await fetch(`${API_URL}/auth/register/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Student',
        lastName: 'Test',
        email: studentEmail,
        password: studentPassword
      })
    });
    if(!regRes.ok) throw new Error('Student registration failed');
    const regData = await regRes.json();
    if(regData.user.role !== 'STUDENT') throw new Error('Role not STUDENT');
    studentToken = regData.access_token;
    console.log('✅ 1. Student Registration');

    // 2. Student Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: studentEmail,
        password: studentPassword
      })
    });
    if(!loginRes.ok) throw new Error('Student login failed');
    console.log('✅ 2. Student Login');

    // 3. Anonymous browsing & Discovery
    const discRes = await fetch(`${API_URL}/properties/search`);
    if(!discRes.ok) throw new Error('Discovery failed');
    console.log('✅ 3. Discovery');

    // 4. Application Creation - Unauthenticated
    const appRes1 = await fetch(`${API_URL}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        roomTypeId,
        moveInDate: '2026-10-01',
        durationMonths: 6
      })
    });
    if(appRes1.status !== 401) throw new Error('Unauth application did not fail with 401');
    console.log('✅ 4. Unauthenticated Application Protection');

    // 5. Application Creation - Authenticated
    const appRes2 = await fetch(`${API_URL}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        propertyId,
        roomTypeId,
        moveInDate: '2026-10-01',
        durationMonths: 6
      })
    });
    if(!appRes2.ok) throw new Error('Authenticated application failed');
    const appData = await appRes2.json();
    if(appData.status !== 'PENDING_REVIEW') throw new Error('Wrong application status');
    applicationId = appData.id;
    console.log('✅ 5. Application Creation');

    // 6. Student Dashboard
    const dashRes = await fetch(`${API_URL}/applications/my`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    if(!dashRes.ok) throw new Error('Student dashboard fetch failed');
    const dashApps = await dashRes.json();
    const myApp = dashApps.find(a => a.id === applicationId);
    if(!myApp || myApp.status !== 'PENDING_REVIEW') throw new Error('App not in dashboard');
    console.log('✅ 6. Student Dashboard');

    console.log('\n🎉 All Student Marketplace E2E tests passed!');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTests();
