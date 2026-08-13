const jwt = require('jsonwebtoken');

const API_URL = 'http://localhost:3001/api/v1'; // NestJS backend

async function testLogin(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Login failed for ${email}:`, data);
    return null;
  }
  return data.access_token;
}

async function testEndpoint(token, endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.status;
}

async function main() {
  const accounts = [
    { role: 'SUPER_ADMIN', email: 'superadmin@jesmond.demo', password: 'Jesmond@Demo2026!' },
    { role: 'ADMIN', email: 'admin@jesmond.demo', password: 'Jesmond@Demo2026!' },
    { role: 'PROVIDER', email: 'provider@jesmond.demo', password: 'Jesmond@Demo2026!' },
    { role: 'STUDENT', email: 'student@jesmond.demo', password: 'Jesmond@Demo2026!' },
  ];

  for (const acc of accounts) {
    console.log(`\nTesting login for ${acc.role} (${acc.email})`);
    const token = await testLogin(acc.email, acc.password);
    if (!token) {
      console.log('FAIL: Could not login');
      continue;
    }

    const decoded = jwt.decode(token);
    console.log(`SUCCESS: JWT Role = ${decoded.role}`);

    // Test Admin endpoint (should be 200 or 403)
    const adminStatus = await testEndpoint(token, '/properties/pending'); // Admin route example, adjust if needed
    // Test Provider endpoint
    const providerStatus = await testEndpoint(token, '/properties/my'); 
    // Test Student endpoint
    const studentStatus = await testEndpoint(token, '/applications/my'); // Student route example

    console.log(`- Admin Access (/properties/pending): HTTP ${adminStatus}`);
    console.log(`- Provider Access (/properties/my): HTTP ${providerStatus}`);
    console.log(`- Student Access (/applications/my): HTTP ${studentStatus}`);
  }
}

main().catch(console.error);
