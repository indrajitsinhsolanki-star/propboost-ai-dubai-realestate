"""
Backend API tests for PropBoost AI Authentication Fix
Tests the auth endpoints to verify the redirect loop bug fix.

Test Scenarios:
1. New email signup must return user data and token
2. Existing email login must return user data and token
3. Session endpoint for Google OAuth must work
5. Unauthenticated API calls should return 401
"""
import pytest
import requests
import os
import uuid
import time

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://propboost-whatsapp.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')


class TestAuthEndpoints:
    """Test authentication endpoints for the auth redirect fix"""
    
    def test_api_health_check(self):
        """Test API is up and running"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "PropBoost AI API"
        print(f"✅ API health check passed: {data}")
    
    def test_signup_new_user_returns_token(self):
        """Scenario 1: New user signup should return user data and JWT token"""
        unique_email = f"test_auth_{int(time.time())}_{uuid.uuid4().hex[:6]}@test.com"
        
        payload = {
            "email": unique_email,
            "password": "TestPassword123!",
            "name": "Test Auth User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
        assert response.status_code == 200, f"Signup failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "user" in data, "Response missing 'user' field"
        assert "token" in data, "Response missing 'token' field"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == unique_email
        assert user["name"] == "Test Auth User"
        assert "user_id" in user
        
        # Verify token is valid JWT format (header.payload.signature)
        token = data["token"]
        assert token.count('.') == 2, "Token is not valid JWT format"
        
        print(f"✅ Signup test passed for: {unique_email}")
        return data
    
    def test_login_existing_user_returns_token(self):
        """Scenario 2: Existing user login should return user data and JWT token"""
        # Use the existing test user
        payload = {
            "email": "indrajitsinh.solanki@gmail.com",
            "password": "PropBoost123!"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "user" in data, "Response missing 'user' field"
        assert "token" in data, "Response missing 'token' field"
        
        # Verify user data
        user = data["user"]
        assert user["email"] == "indrajitsinh.solanki@gmail.com"
        
        # Verify token is valid JWT format
        token = data["token"]
        assert token.count('.') == 2, "Token is not valid JWT format"
        
        # Verify message
        assert data.get("message") == "Login successful"
        
        print(f"✅ Login test passed for: {user['email']}")
        return data
    
    def test_login_with_invalid_credentials_returns_401(self):
        """Test that invalid credentials return 401"""
        payload = {
            "email": "invalid@test.com",
            "password": "wrongpassword"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✅ Invalid credentials correctly rejected with 401")
    
    def test_protected_endpoint_requires_auth(self):
        """Scenario 5: Unauthenticated API calls should return 401"""
        # Try to access protected endpoint without token
        response = requests.get(f"{BASE_URL}/api/leads")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
        print("✅ Protected endpoint correctly requires authentication")
    
    def test_protected_endpoint_with_valid_token(self):
        """Test that protected endpoints work with valid token"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "indrajitsinh.solanki@gmail.com",
            "password": "PropBoost123!"
        })
        assert login_response.status_code == 200
        
        token = login_response.json()["token"]
        
        # Now access protected endpoint with token
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        assert response.status_code == 200, f"Protected endpoint failed: {response.text}"
        
        # Verify response is a list of leads
        data = response.json()
        assert isinstance(data, list), "Expected list of leads"
        
        print(f"✅ Protected endpoint accessible with valid token. Found {len(data)} leads.")
    
    def test_me_endpoint_returns_user_data(self):
        """Test /api/auth/me endpoint returns user data with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "indrajitsinh.solanki@gmail.com",
            "password": "PropBoost123!"
        })
        assert login_response.status_code == 200
        
        token = login_response.json()["token"]
        
        # Get user data
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        user = response.json()
        assert user["email"] == "indrajitsinh.solanki@gmail.com"
        assert "password_hash" not in user, "Password hash should not be exposed!"
        
        print(f"✅ /api/auth/me endpoint working correctly for: {user['email']}")
    
    def test_logout_clears_session(self):
        """Test logout endpoint"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "indrajitsinh.solanki@gmail.com",
            "password": "PropBoost123!"
        })
        assert login_response.status_code == 200
        
        token = login_response.json()["token"]
        
        # Logout
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("message") == "Logged out successfully"
        
        print("✅ Logout endpoint working correctly")
    
    def test_signup_duplicate_email_returns_400(self):
        """Test that signup with existing email returns 400"""
        # Try to signup with existing email
        payload = {
            "email": "indrajitsinh.solanki@gmail.com",
            "password": "TestPassword123!",
            "name": "Duplicate User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/signup", json=payload)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "already registered" in data.get("detail", "").lower() or "already exists" in data.get("detail", "").lower()
        
        print("✅ Duplicate email correctly rejected with 400")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
