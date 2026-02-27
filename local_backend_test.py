#!/usr/bin/env python3
"""
Quick local backend test for new features
Tests the new API endpoints: Omnichannel, Follow-ups, Maya Learning
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8001/api"

def test_new_features():
    print("🚀 Testing PropBoostAI New Features APIs locally...")
    print("=" * 60)
    
    # 1. Create test user and login
    print("\n1️⃣ Creating test user...")
    timestamp = datetime.now().strftime("%H%M%S")
    signup_data = {
        "name": "Test Agent",
        "email": f"test.agent.{timestamp}@propboost.ai",
        "password": "TestPass123!",
        "company": "PropBoost Testing",
        "phone": "+971501234567"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
        if response.status_code == 200:
            data = response.json()
            auth_token = data.get("token")
            print(f"✅ User created successfully, got token: {auth_token[:20]}...")
            headers = {'Authorization': f'Bearer {auth_token}', 'Content-Type': 'application/json'}
        else:
            print(f"❌ Signup failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Signup error: {e}")
        return False
    
    # 2. Create a test lead
    print("\n2️⃣ Creating test lead...")
    lead_data = {
        "name": "Ahmed Al-Rashid",
        "phone": "+971501234567",
        "email": "ahmed.rashid@example.com",
        "language_preference": "English",
        "lead_source": "Property Finder",
        "estimated_deal_value": 3500000,
        "property_interests": {
            "location": "Downtown Dubai",
            "bedrooms": "3",
            "budget": "3000000",
            "property_type": "Apartment"
        },
        "notes": "Test lead for new features"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/leads", json=lead_data, headers=headers)
        if response.status_code == 200:
            lead = response.json()
            lead_id = lead.get("id")
            print(f"✅ Lead created: {lead['name']}, Score: {lead.get('score', 'N/A')}")
        else:
            print(f"❌ Lead creation failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Lead creation error: {e}")
        return False
    
    # 3. Test Omnichannel Outreach APIs
    print("\n3️⃣ Testing Omnichannel Outreach APIs...")
    
    # Get outreach stats
    try:
        response = requests.get(f"{BASE_URL}/outreach/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Outreach stats: {stats}")
        else:
            print(f"❌ Outreach stats failed: {response.text}")
    except Exception as e:
        print(f"❌ Outreach stats error: {e}")
    
    # Create outreach sequence
    try:
        sequence_data = {"lead_id": lead_id}
        response = requests.post(f"{BASE_URL}/outreach/sequences", json=sequence_data, headers=headers)
        if response.status_code == 200:
            sequence = response.json()
            sequence_id = sequence.get("id")
            print(f"✅ Outreach sequence created: {sequence_id}")
        else:
            print(f"❌ Outreach sequence creation failed: {response.text}")
    except Exception as e:
        print(f"❌ Outreach sequence error: {e}")
    
    # 4. Test Follow-up Cadences APIs
    print("\n4️⃣ Testing Follow-up Cadences APIs...")
    
    # Get followup stats
    try:
        response = requests.get(f"{BASE_URL}/followups/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Follow-up stats: {stats}")
        else:
            print(f"❌ Follow-up stats failed: {response.text}")
    except Exception as e:
        print(f"❌ Follow-up stats error: {e}")
    
    # Create followup cadence
    try:
        response = requests.post(f"{BASE_URL}/followups/cadences?lead_id={lead_id}&trigger_reason=missed_call", headers=headers)
        if response.status_code == 200:
            cadence = response.json()
            cadence_id = cadence.get("id")
            print(f"✅ Follow-up cadence created: {cadence_id}")
        else:
            print(f"❌ Follow-up cadence creation failed: {response.text}")
    except Exception as e:
        print(f"❌ Follow-up cadence error: {e}")
    
    # 5. Test Maya Learning Engine APIs
    print("\n5️⃣ Testing Maya Learning Engine APIs...")
    
    # Get learning stats
    try:
        response = requests.get(f"{BASE_URL}/learning/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Learning stats: {stats}")
        else:
            print(f"❌ Learning stats failed: {response.text}")
    except Exception as e:
        print(f"❌ Learning stats error: {e}")
    
    # Get learning patterns
    try:
        response = requests.get(f"{BASE_URL}/learning/patterns", headers=headers)
        if response.status_code == 200:
            patterns = response.json()
            print(f"✅ Learning patterns: {type(patterns)} with keys: {list(patterns.keys()) if isinstance(patterns, dict) else 'N/A'}")
        else:
            print(f"❌ Learning patterns failed: {response.text}")
    except Exception as e:
        print(f"❌ Learning patterns error: {e}")
    
    # Get conversations
    try:
        response = requests.get(f"{BASE_URL}/learning/conversations?limit=10", headers=headers)
        if response.status_code == 200:
            conversations = response.json()
            print(f"✅ Conversations: {len(conversations) if isinstance(conversations, list) else 'N/A'} items")
        else:
            print(f"❌ Conversations failed: {response.text}")
    except Exception as e:
        print(f"❌ Conversations error: {e}")
    
    print(f"\n✅ New Features API testing completed!")
    return True

if __name__ == "__main__":
    test_new_features()