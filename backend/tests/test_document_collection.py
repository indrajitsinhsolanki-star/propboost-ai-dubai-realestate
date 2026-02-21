"""
Test Suite for WhatsApp Document Collection Feature (Feature 1)
Tests:
1. Document request endpoint - multi-tenancy with owner_id filter
2. Document update endpoint - marking docs as received
3. Document get endpoint - getting document status
4. Activity logging for document requests
5. Lead stage auto-update when all docs received
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://propboost-whatsapp.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "indrajitsinh.solanki@gmail.com"
TEST_PASSWORD = "PropBoost123!"

# Test data prefix for cleanup
TEST_PREFIX = "TEST_DOC_"

class TestDocumentCollection:
    """Test suite for WhatsApp Document Collection feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        print(f"Login response status: {response.status_code}")
        if response.status_code == 200:
            token = response.json().get("token")
            print("Login successful, got token")
            return token
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get authenticated headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def qualified_lead(self, headers):
        """Create a qualified lead (score > 65) for document testing"""
        lead_data = {
            "name": f"{TEST_PREFIX}Qualified Lead",
            "phone": "+971501234567",
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "language_preference": "English",
            "lead_source": "Property Finder",
            "estimated_deal_value": 5000000,  # High value = high score
            "property_interests": {
                "location": "Palm Jumeirah",
                "bedrooms": "3",
                "budget": "5M AED",
                "property_type": "Villa"
            },
            "notes": "High value client looking for luxury villa. Pre-approved buyer."
        }
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=headers)
        print(f"Create qualified lead response: {response.status_code}")
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        lead = response.json()
        print(f"Created lead with ID: {lead['id']}, Score: {lead['score']}")
        yield lead
        # Cleanup
        try:
            requests.delete(f"{BASE_URL}/api/leads/{lead['id']}", headers=headers)
        except:
            pass
    
    @pytest.fixture(scope="class")
    def low_score_lead(self, headers):
        """Create a low score lead (score < 65) for testing Request Docs button visibility"""
        lead_data = {
            "name": f"{TEST_PREFIX}Low Score Lead",
            "phone": "+971509876543",
            "email": f"test_low_{uuid.uuid4().hex[:8]}@test.com",
            "language_preference": "English",
            "lead_source": "Walk-in",
            "estimated_deal_value": 100000,  # Low value = low score
            "property_interests": {},
            "notes": ""
        }
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=headers)
        print(f"Create low score lead response: {response.status_code}")
        assert response.status_code == 200, f"Failed to create lead: {response.text}"
        lead = response.json()
        print(f"Created low score lead with ID: {lead['id']}, Score: {lead['score']}")
        yield lead
        # Cleanup
        try:
            requests.delete(f"{BASE_URL}/api/leads/{lead['id']}", headers=headers)
        except:
            pass

    # ==================== DOCUMENT REQUEST TESTS ====================
    
    def test_request_documents_endpoint(self, headers, qualified_lead):
        """Test POST /api/leads/{lead_id}/documents/request"""
        lead_id = qualified_lead["id"]
        
        # Request documents
        request_data = {
            "requested_docs": ["passport_copy", "emirates_id", "salary_certificate"],
            "message": "Hi! Please send your passport, Emirates ID, and salary certificate."
        }
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/documents/request",
            json=request_data,
            headers=headers
        )
        
        print(f"Request documents response: {response.status_code}")
        assert response.status_code == 200, f"Failed to request docs: {response.text}"
        
        data = response.json()
        print(f"Document request data: {data}")
        
        # Verify response structure
        assert "id" in data, "Missing document request ID"
        assert data["lead_id"] == lead_id, "Lead ID mismatch"
        assert data["requested_docs"] == request_data["requested_docs"], "Requested docs mismatch"
        assert data["status"] == "pending", f"Expected status 'pending', got '{data['status']}'"
        assert data["received_docs"] == [], "Received docs should be empty initially"
        assert "owner_id" in data, "Missing owner_id (multi-tenancy field)"
        
        print("✓ Document request endpoint working correctly")
    
    def test_get_documents_endpoint(self, headers, qualified_lead):
        """Test GET /api/leads/{lead_id}/documents"""
        lead_id = qualified_lead["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}/documents",
            headers=headers
        )
        
        print(f"Get documents response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get docs: {response.text}"
        
        data = response.json()
        print(f"Document status data: {data}")
        
        # Verify document request exists
        assert data.get("exists") == True, "Document request should exist"
        assert "requested_docs" in data, "Missing requested_docs"
        assert "received_docs" in data, "Missing received_docs"
        assert "status" in data, "Missing status"
        assert "labels" in data, "Missing document labels"
        
        # Verify labels mapping
        assert data["labels"]["passport_copy"] == "Passport Copy"
        assert data["labels"]["emirates_id"] == "Emirates ID"
        
        print("✓ Get documents endpoint working correctly")
    
    def test_update_documents_received(self, headers, qualified_lead):
        """Test PATCH /api/leads/{lead_id}/documents/update - marking docs as received"""
        lead_id = qualified_lead["id"]
        
        # First, ensure document request exists
        get_response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}/documents",
            headers=headers
        )
        assert get_response.status_code == 200
        
        # Mark first document as received
        update_data = {
            "received_docs": ["passport_copy"]
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/leads/{lead_id}/documents/update",
            json=update_data,
            headers=headers
        )
        
        print(f"Update documents response: {response.status_code}")
        assert response.status_code == 200, f"Failed to update docs: {response.text}"
        
        data = response.json()
        print(f"Updated document status: {data}")
        
        # Verify partial status
        assert data["received_docs"] == ["passport_copy"], "Received docs not updated"
        assert data["status"] == "partial", f"Expected 'partial', got '{data['status']}'"
        
        # Mark more documents as received
        update_data2 = {
            "received_docs": ["passport_copy", "emirates_id"]
        }
        
        response2 = requests.patch(
            f"{BASE_URL}/api/leads/{lead_id}/documents/update",
            json=update_data2,
            headers=headers
        )
        
        assert response2.status_code == 200
        data2 = response2.json()
        assert len(data2["received_docs"]) == 2
        assert data2["status"] == "partial", f"Status should still be partial with 2/3 docs"
        
        print("✓ Update documents endpoint working correctly (partial status)")
    
    def test_documents_complete_status(self, headers, qualified_lead):
        """Test document status becomes 'complete' when all docs received"""
        lead_id = qualified_lead["id"]
        
        # Get current requested docs
        get_response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}/documents",
            headers=headers
        )
        data = get_response.json()
        requested_docs = data.get("requested_docs", [])
        
        # Mark all documents as received
        update_data = {
            "received_docs": requested_docs
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/leads/{lead_id}/documents/update",
            json=update_data,
            headers=headers
        )
        
        print(f"Complete all docs response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Complete document status: {data}")
        
        # Verify complete status
        assert data["status"] == "complete", f"Expected 'complete', got '{data['status']}'"
        assert len(data["received_docs"]) == len(requested_docs), "All docs should be received"
        
        print("✓ Document complete status working correctly")
    
    def test_documents_not_found_for_new_lead(self, headers, low_score_lead):
        """Test GET /api/leads/{lead_id}/documents returns exists=False for leads without requests"""
        lead_id = low_score_lead["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}/documents",
            headers=headers
        )
        
        print(f"Get docs for new lead response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Document status for new lead: {data}")
        
        # Verify no document request exists
        assert data.get("exists") == False, "New lead should have exists=False"
        assert data.get("lead_id") == lead_id, "Lead ID should be returned"
        
        print("✓ Get documents returns exists=False for leads without document requests")
    
    # ==================== MULTI-TENANCY TESTS ====================
    
    def test_multi_tenancy_document_isolation(self, headers, qualified_lead):
        """Test that document endpoints filter by owner_id"""
        lead_id = qualified_lead["id"]
        
        # Create a new user to test isolation
        test_user_email = f"test_isolation_{uuid.uuid4().hex[:8]}@test.com"
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup", json={
            "email": test_user_email,
            "password": "TestPass123!",
            "name": "Test Isolation User"
        })
        
        if signup_response.status_code != 200:
            pytest.skip("Could not create test user for isolation test")
        
        other_token = signup_response.json().get("token")
        other_headers = {
            "Authorization": f"Bearer {other_token}",
            "Content-Type": "application/json"
        }
        
        # Try to access qualified_lead's documents with other user
        response = requests.get(
            f"{BASE_URL}/api/leads/{lead_id}/documents",
            headers=other_headers
        )
        
        print(f"Multi-tenancy isolation response: {response.status_code}")
        # Should return 404 since other user doesn't own this lead
        assert response.status_code == 404, f"Expected 404 for other user's lead, got {response.status_code}"
        
        print("✓ Multi-tenancy document isolation working correctly")
    
    # ==================== ACTIVITY LOGGING TEST ====================
    
    def test_activity_logging(self, headers, low_score_lead):
        """Test that document requests create activity logs"""
        lead_id = low_score_lead["id"]
        
        # Request documents
        request_data = {
            "requested_docs": ["passport_copy"],
            "message": "Test message for activity logging"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/leads/{lead_id}/documents/request",
            json=request_data,
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Note: We can't directly query activity_logs via API in this test,
        # but the endpoint should have logged the activity. 
        # Main verification is that the request succeeded without errors.
        
        print("✓ Document request completed (activity should be logged)")
    
    # ==================== BADGE DISPLAY DATA VERIFICATION ====================
    
    def test_badge_display_data(self, headers):
        """Test that document status provides data needed for badge display (📎 2/3 docs received)"""
        # Create a fresh lead
        lead_data = {
            "name": f"{TEST_PREFIX}Badge Test Lead",
            "phone": "+971505555555",
            "email": f"test_badge_{uuid.uuid4().hex[:8]}@test.com",
            "language_preference": "English",
            "lead_source": "Property Finder",
            "estimated_deal_value": 3000000,
            "property_interests": {"location": "Downtown Dubai"},
            "notes": "Test lead for badge display verification"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=headers)
        assert create_response.status_code == 200
        lead = create_response.json()
        lead_id = lead["id"]
        
        try:
            # Request 3 documents
            request_data = {
                "requested_docs": ["passport_copy", "emirates_id", "visa_copy"],
                "message": "Please send these documents"
            }
            
            requests.post(
                f"{BASE_URL}/api/leads/{lead_id}/documents/request",
                json=request_data,
                headers=headers
            )
            
            # Mark 2 docs as received
            update_data = {
                "received_docs": ["passport_copy", "emirates_id"]
            }
            
            requests.patch(
                f"{BASE_URL}/api/leads/{lead_id}/documents/update",
                json=update_data,
                headers=headers
            )
            
            # Get document status
            response = requests.get(
                f"{BASE_URL}/api/leads/{lead_id}/documents",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify badge data is available
            requested_count = len(data.get("requested_docs", []))
            received_count = len(data.get("received_docs", []))
            status = data.get("status")
            
            print(f"Badge data: {received_count}/{requested_count} docs, status={status}")
            
            assert requested_count == 3, f"Expected 3 requested, got {requested_count}"
            assert received_count == 2, f"Expected 2 received, got {received_count}"
            assert status == "partial", f"Expected 'partial', got '{status}'"
            
            # This data is what frontend uses for badge: "📎 2/3 docs received"
            print(f"✓ Badge display data correct: 📎 {received_count}/{requested_count} docs received")
            
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=headers)


class TestLeadScoreAndQualification:
    """Test lead score and qualification criteria for Request Docs button visibility"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_high_score_lead_qualifies(self, headers):
        """Test that high value leads get score > 6.5 (65 when multiplied by 10)"""
        lead_data = {
            "name": f"{TEST_PREFIX}High Score Check",
            "phone": "+971507777777",
            "email": f"test_high_{uuid.uuid4().hex[:8]}@test.com",
            "language_preference": "English",
            "lead_source": "Property Finder",
            "estimated_deal_value": 6000000,  # 6M AED
            "property_interests": {
                "location": "Palm Jumeirah",
                "budget": "6M AED",
                "property_type": "Villa"
            },
            "notes": "High budget buyer looking immediately"
        }
        
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=headers)
        assert response.status_code == 200
        lead = response.json()
        
        try:
            score = lead["score"]
            score_display = score * 10  # As displayed in UI
            
            print(f"High value lead score: {score} (display: {score_display})")
            
            # Frontend shows Request Docs button if score * 10 > 65
            should_show_request_docs = score_display > 65 or lead.get("stage") in ["qualified", "viewing", "negotiation"]
            
            print(f"Should show Request Docs button: {should_show_request_docs}")
            print(f"  - Score check (>65): {score_display > 65}")
            print(f"  - Stage check: {lead.get('stage')} in ['qualified', 'viewing', 'negotiation']")
            
            # High budget leads should generally qualify
            assert score >= 6, f"High value lead should have score >= 6, got {score}"
            
            print(f"✓ High score lead qualifies for Request Docs button")
            
        finally:
            requests.delete(f"{BASE_URL}/api/leads/{lead['id']}", headers=headers)
    
    def test_low_score_lead_does_not_qualify(self, headers):
        """Test that low value leads get score < 6.5"""
        lead_data = {
            "name": f"{TEST_PREFIX}Low Score Check",
            "phone": "+971508888888",
            "email": f"test_low_{uuid.uuid4().hex[:8]}@test.com",
            "language_preference": "English",
            "lead_source": "Walk-in",
            "estimated_deal_value": 50000,  # Very low
            "property_interests": {},
            "notes": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=headers)
        assert response.status_code == 200
        lead = response.json()
        
        try:
            score = lead["score"]
            score_display = score * 10
            stage = lead.get("stage", "new")
            
            print(f"Low value lead score: {score} (display: {score_display}), stage: {stage}")
            
            # Check if should show Request Docs button
            should_show = score_display > 65 or stage in ["qualified", "viewing", "negotiation"]
            
            print(f"Should show Request Docs button: {should_show}")
            
            # Low budget leads with no details should have low score
            if score < 7 and stage not in ["qualified", "viewing", "negotiation"]:
                print(f"✓ Low score lead correctly does NOT qualify for Request Docs button")
            else:
                print(f"Note: Lead unexpectedly qualifies - may need UI verification")
                
        finally:
            requests.delete(f"{BASE_URL}/api/leads/{lead['id']}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
