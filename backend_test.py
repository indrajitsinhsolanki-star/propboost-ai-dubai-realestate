import requests
import sys
import json
from datetime import datetime

class PropBoostAPITester:
    def __init__(self, base_url="https://agentboost-11.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}
        self.auth_token = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, auth_required=False):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add auth header if required and token available
        if auth_required and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if auth_required:
            print(f"   Auth: {'✓' if self.auth_token else '✗'}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    # ==================== AUTHENTICATION TESTS ====================
    
    def test_user_signup(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%H%M%S")
        signup_data = {
            "name": "Test Agent",
            "email": f"test.agent.{timestamp}@propboost.ai",
            "password": "TestPass123!",
            "company": "PropBoost Testing",
            "phone": "+971501234567"
        }
        
        success, response = self.run_test("User Signup", "POST", "auth/signup", 200, signup_data)
        if success and 'token' in response:
            self.auth_token = response['token']
            self.test_data['user_id'] = response['user']['user_id']
            print(f"   User ID: {response['user']['user_id']}")
            print(f"   Token: {self.auth_token[:20]}...")
        return success, response

    def test_user_login(self):
        """Test user login"""
        # Use the same credentials from signup
        timestamp = datetime.now().strftime("%H%M%S")
        login_data = {
            "email": f"test.agent.{timestamp}@propboost.ai",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        if success and 'token' in response:
            self.auth_token = response['token']
            print(f"   Login Token: {self.auth_token[:20]}...")
        return success, response

    def test_get_current_user(self):
        """Test getting current authenticated user"""
        return self.run_test("Get Current User", "GET", "auth/me", 200, auth_required=True)

    def test_protected_route_without_auth(self):
        """Test that protected routes require authentication"""
        # Temporarily remove token
        temp_token = self.auth_token
        self.auth_token = None
        
        success, response = self.run_test("Protected Route (No Auth)", "GET", "leads", 401, auth_required=False)
        
        # Restore token
        self.auth_token = temp_token
        return success, response

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        return self.run_test("Dashboard Stats", "GET", "dashboard/stats", 200, auth_required=True)

    # ==================== LEAD TESTS (UPDATED FOR PHASE 2) ====================

    def test_create_lead(self):
        """Test lead creation with AI scoring and new Phase 2 fields"""
        lead_data = {
            "name": "Ahmed Al-Rashid",
            "phone": "+971501234567",
            "email": "ahmed.rashid@example.com",
            "language_preference": "Arabic",
            "lead_source": "Property Finder",  # NEW FIELD
            "estimated_deal_value": 5500000,   # NEW FIELD
            "property_interests": {
                "location": "Downtown Dubai",
                "bedrooms": "3",
                "budget": "5000000",
                "property_type": "Apartment"
            },
            "notes": "High-value client interested in luxury properties with sea view"
        }
        
        success, response = self.run_test("Create Lead (Phase 2)", "POST", "leads", 200, lead_data, auth_required=True)
        if success and 'id' in response:
            self.test_data['lead_id'] = response['id']
            print(f"   Lead Score: {response.get('score', 'N/A')}/10")
            print(f"   Lead Source: {response.get('lead_source', 'N/A')}")
            print(f"   Deal Value: {response.get('estimated_deal_value', 'N/A')} AED")
            print(f"   AI Briefing: {response.get('ai_briefing', 'N/A')[:100]}...")
            
            # Check if Maya call was triggered for hot leads
            if response.get('score', 0) > 7:
                print(f"   🔥 Hot Lead - Maya call should be triggered")
        return success, response

    def test_get_leads(self):
        """Test getting all leads"""
        return self.run_test("Get All Leads", "GET", "leads", 200, auth_required=True)

    def test_get_lead_by_id(self):
        """Test getting specific lead"""
        if 'lead_id' not in self.test_data:
            print("❌ Skipped - No lead ID available")
            return False, {}
        
        return self.run_test("Get Lead by ID", "GET", f"leads/{self.test_data['lead_id']}", 200, auth_required=True)

    def test_rescore_lead(self):
        """Test lead rescoring"""
        if 'lead_id' not in self.test_data:
            print("❌ Skipped - No lead ID available")
            return False, {}
        
        return self.run_test("Rescore Lead", "POST", f"leads/{self.test_data['lead_id']}/rescore", 200, auth_required=True)

    # ==================== ANALYTICS TESTS (NEW IN PHASE 2) ====================

    def test_analytics_leaderboard(self):
        """Test lead source leaderboard analytics"""
        success, response = self.run_test("Analytics Leaderboard", "GET", "analytics/leaderboard", 200, auth_required=True)
        if success and 'leaderboard' in response:
            print(f"   Leaderboard entries: {len(response['leaderboard'])}")
            for entry in response['leaderboard'][:3]:  # Show top 3
                print(f"   #{entry.get('rank', 'N/A')}: {entry.get('source', 'N/A')} - {entry.get('conversion_rate', 0)}% conversion")
        return success, response

    def test_score_distribution(self):
        """Test lead score distribution analytics"""
        return self.run_test("Score Distribution", "GET", "analytics/score-distribution", 200, auth_required=True)

    def test_source_performance(self):
        """Test source performance analytics"""
        return self.run_test("Source Performance", "GET", "analytics/source-performance", 200, auth_required=True)

    # ==================== VOICE AI TESTS (NEW IN PHASE 2) ====================

    def test_trigger_voice_call(self):
        """Test Maya voice AI call trigger (simulated)"""
        if 'lead_id' not in self.test_data:
            print("❌ Skipped - No lead ID available")
            return False, {}
        
        voice_data = {
            "lead_id": self.test_data['lead_id'],
            "language": "English"
        }
        
        success, response = self.run_test("Trigger Maya Voice Call", "POST", "voice/trigger-call", 200, voice_data, auth_required=True)
        if success:
            print(f"   Call Status: {response.get('status', 'N/A')}")
            print(f"   Call ID: {response.get('call_id', 'N/A')}")
            if response.get('status') == 'simulated':
                print(f"   ✓ Simulated response (expected - no Retell credentials)")
        return success, response

    def test_create_lead(self):
        """Test lead creation with AI scoring"""
        lead_data = {
            "name": "Ahmed Al-Rashid",
            "phone": "+971501234567",
            "email": "ahmed.rashid@example.com",
            "language_preference": "Arabic",
            "property_interests": {
                "location": "Downtown Dubai",
                "bedrooms": "3",
                "budget": "5000000",
                "property_type": "Apartment"
            },
            "notes": "High-value client interested in luxury properties with sea view"
        }
        
        success, response = self.run_test("Create Lead", "POST", "leads", 200, lead_data)
        if success and 'id' in response:
            self.test_data['lead_id'] = response['id']
            print(f"   Lead Score: {response.get('score', 'N/A')}/10")
            print(f"   AI Briefing: {response.get('ai_briefing', 'N/A')[:100]}...")
        return success, response

    def test_get_leads(self):
        """Test getting all leads"""
        return self.run_test("Get All Leads", "GET", "leads", 200)

    def test_get_lead_by_id(self):
        """Test getting specific lead"""
        if 'lead_id' not in self.test_data:
            print("❌ Skipped - No lead ID available")
            return False, {}
        
        return self.run_test("Get Lead by ID", "GET", f"leads/{self.test_data['lead_id']}", 200)

    def test_rescore_lead(self):
        """Test lead rescoring"""
        if 'lead_id' not in self.test_data:
            print("❌ Skipped - No lead ID available")
            return False, {}
        
        return self.run_test("Rescore Lead", "POST", f"leads/{self.test_data['lead_id']}/rescore", 200)

    def test_create_property(self):
        """Test property creation"""
        property_data = {
            "title": "Luxury Sea View Apartment",
            "location": "Palm Jumeirah",
            "bedrooms": 3,
            "bathrooms": 3,
            "price": 4500000,
            "currency": "AED",
            "amenities": ["Pool", "Gym", "Beach Access", "Concierge"],
            "description": "Stunning 3-bedroom apartment with panoramic sea views",
            "property_type": "Apartment",
            "area_sqft": 2500,
            "images": []
        }
        
        success, response = self.run_test("Create Property", "POST", "properties", 200, property_data)
        if success and 'id' in response:
            self.test_data['property_id'] = response['id']
        return success, response

    def test_get_properties(self):
        """Test getting all properties"""
        return self.run_test("Get All Properties", "GET", "properties", 200)

    def test_generate_content(self):
        """Test AI content generation"""
        if 'property_id' not in self.test_data:
            print("❌ Skipped - No property ID available")
            return False, {}
        
        content_request = {
            "property_id": self.test_data['property_id'],
            "platforms": ["instagram", "facebook", "whatsapp"],
            "languages": ["English", "Arabic"]
        }
        
        success, response = self.run_test("Generate Content", "POST", "content/generate", 200, content_request)
        if success and 'contents' in response:
            print(f"   Generated {response.get('count', 0)} content pieces")
            if response['contents']:
                self.test_data['content_id'] = response['contents'][0]['id']
        return success, response

    def test_get_property_content(self):
        """Test getting property content"""
        if 'property_id' not in self.test_data:
            print("❌ Skipped - No property ID available")
            return False, {}
        
        return self.run_test("Get Property Content", "GET", f"content/{self.test_data['property_id']}", 200)

    def test_approve_content(self):
        """Test content approval"""
        if 'content_id' not in self.test_data:
            print("❌ Skipped - No content ID available")
            return False, {}
        
        approval_data = {
            "content_id": self.test_data['content_id'],
            "approved": True
        }
        
        return self.run_test("Approve Content", "PUT", f"content/{self.test_data['content_id']}/approve", 200, approval_data)

    def test_generate_whatsapp_message(self):
        """Test WhatsApp message generation"""
        if 'lead_id' not in self.test_data:
            print("❌ Skipped - No lead ID available")
            return False, {}
        
        endpoint = f"whatsapp/generate?lead_id={self.test_data['lead_id']}&message_type=reminder&language=English"
        
        success, response = self.run_test("Generate WhatsApp Message", "POST", endpoint, 200)
        if success and 'id' in response:
            self.test_data['whatsapp_id'] = response['id']
            print(f"   Message: {response.get('message', 'N/A')[:100]}...")
        return success, response

    def test_approve_whatsapp(self):
        """Test WhatsApp message approval"""
        if 'whatsapp_id' not in self.test_data:
            print("❌ Skipped - No WhatsApp message ID available")
            return False, {}
        
        return self.run_test("Approve WhatsApp", "PUT", f"whatsapp/{self.test_data['whatsapp_id']}/approve", 200)

    def test_send_whatsapp(self):
        """Test WhatsApp message sending (simulated)"""
        if 'whatsapp_id' not in self.test_data:
            print("❌ Skipped - No WhatsApp message ID available")
            return False, {}
        
        return self.run_test("Send WhatsApp", "PUT", f"whatsapp/{self.test_data['whatsapp_id']}/send", 200)

    def test_update_pipeline_stage(self):
        """Test pipeline stage update"""
        if 'lead_id' not in self.test_data:
            print("❌ Skipped - No lead ID available")
            return False, {}
        
        endpoint = f"pipeline/{self.test_data['lead_id']}/stage?stage=qualified&probability=70"
        
        return self.run_test("Update Pipeline Stage", "PUT", endpoint, 200)

    def test_pipeline_stats(self):
        """Test pipeline statistics"""
        return self.run_test("Pipeline Stats", "GET", "pipeline/stats", 200)

    def test_activity_logs(self):
        """Test activity logs"""
        return self.run_test("Activity Logs", "GET", "activity-logs", 200)

def main():
    print("🚀 Starting PropBoost AI API Testing...")
    print("=" * 60)
    
    tester = PropBoostAPITester()
    
    # Test sequence
    test_methods = [
        tester.test_root_endpoint,
        tester.test_dashboard_stats,
        tester.test_create_lead,
        tester.test_get_leads,
        tester.test_get_lead_by_id,
        tester.test_rescore_lead,
        tester.test_create_property,
        tester.test_get_properties,
        tester.test_generate_content,
        tester.test_get_property_content,
        tester.test_approve_content,
        tester.test_generate_whatsapp_message,
        tester.test_approve_whatsapp,
        tester.test_send_whatsapp,
        tester.test_update_pipeline_stage,
        tester.test_pipeline_stats,
        tester.test_activity_logs
    ]
    
    print(f"\n📋 Running {len(test_methods)} API tests...")
    
    for test_method in test_methods:
        try:
            test_method()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All API tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())