// Simple test script to verify the authentication API
const API_BASE_URL = 'http://localhost:4000/api';

async function testAuthAPI() {
  console.log('Testing Authentication API...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✓ Health check passed:', healthData);
    } else {
      console.log('✗ Health check failed:', healthResponse.status);
    }

    // Test 2: Login with invalid credentials (should fail)
    console.log('\n2. Testing login with invalid credentials...');
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId: 'invalid',
        password: 'invalid'
      })
    });
    
    const loginData = await loginResponse.json();
    if (loginResponse.status === 401) {
      console.log('✓ Invalid login correctly rejected:', loginData.error);
    } else {
      console.log('✗ Invalid login should have been rejected:', loginData);
    }

    // Test 3: Test protected endpoint without token
    console.log('\n3. Testing protected endpoint without token...');
    const protectedResponse = await fetch(`${API_BASE_URL}/auth/me`);
    const protectedData = await protectedResponse.json();
    if (protectedResponse.status === 401) {
      console.log('✓ Protected endpoint correctly requires authentication:', protectedData.error);
    } else {
      console.log('✗ Protected endpoint should require authentication:', protectedData);
    }

    console.log('\n✓ Authentication API tests completed successfully!');
    console.log('\nNote: To test successful login, you need to:');
    console.log('1. Run the backend server: npm run backend:dev');
    console.log('2. Create a test user in the database');
    console.log('3. Use valid credentials in the frontend');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
    console.log('\nMake sure the backend server is running on port 4000');
    console.log('Run: npm run backend:dev');
  }
}

testAuthAPI();