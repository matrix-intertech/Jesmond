const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function runTest() {
  try {
    console.log("1. Logging in...");
    const loginRes = await axios.post('http://localhost:3001/api/v1/auth/login', {
      email: 'provider@jesmond.demo',
      password: 'Jesmond@Demo2026!'
    });
    const token = loginRes.data.access_token;
    console.log("Login OK");

    console.log("2. Fetching my properties...");
    const propsRes = await axios.get('http://localhost:3001/api/v1/properties/my', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const propsData = propsRes.data;
    if (!propsData.length) throw new Error("No properties found");
    const propertyId = propsData[0].id;
    console.log(`Found property: ${propertyId}`);

    console.log("3. Uploading test image...");
    const form = new FormData();
    const testImagePath = path.join(__dirname, 'apps/web/public/assets/property-placeholder.png');
    form.append('file', fs.createReadStream(testImagePath));

    const uploadRes = await axios.post(`http://localhost:3001/api/v1/properties/my/${propertyId}/media`, form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      }
    });
    
    console.log("Upload response:", uploadRes.status, uploadRes.data);
    const mediaUrl = uploadRes.data.url;
    
    console.log("4. Verifying public URL accessibility...");
    const publicRes = await axios.get(mediaUrl);
    console.log("Public URL fetch status:", publicRes.status);
    console.log("Public URL content-type:", publicRes.headers['content-type']);
    
  } catch (error) {
    console.error("Error occurred:");
    if (error.response) {
      console.error(error.response.status, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}
runTest();
