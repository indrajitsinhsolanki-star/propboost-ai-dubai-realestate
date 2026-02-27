from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json
import bcrypt
import jwt
import httpx
import hmac
import hashlib
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'propboost-ai-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 168  # 7 days

# Create the main app
app = FastAPI(title="PropBoost AI API", version="2.0.0")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

security = HTTPBearer(auto_error=False)

# ==================== AUTHENTICATION MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    company: str = ""
    phone: str = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str
    company: str = ""
    phone: str = ""
    picture: str = ""
    role: str = "agent"  # agent, admin
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

# ==================== LEAD MODELS (UPDATED) ====================

class LeadCreate(BaseModel):
    name: str
    phone: str
    email: str
    language_preference: str = "English"
    property_interests: Dict[str, Any] = {}
    notes: str = ""
    lead_source: str = "Walk-in"  # NEW: Property Finder, Bayut, Instagram, WhatsApp, Walk-in
    estimated_deal_value: float = 0  # NEW: Estimated deal value in AED

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str = ""  # MULTI-TENANT: User who owns this lead
    name: str
    phone: str
    email: str
    language_preference: str = "English"
    property_interests: Dict[str, Any] = {}
    notes: str = ""
    score: int = 0
    score_reasoning: str = ""
    stage: str = "new"
    probability: int = 0
    ai_briefing: str = ""
    interactions: List[Dict[str, Any]] = []
    lead_source: str = "Walk-in"
    estimated_deal_value: float = 0
    maya_call_status: str = ""
    maya_call_id: str = ""
    maya_call_summary: str = ""  # BANT summary from Maya
    maya_recording_url: str = ""  # Recording URL
    maya_bant: Dict[str, Any] = {}  # BANT qualification data
    maya_confidence_score: int = 0  # AI confidence percentage
    compliance_status: str = "verified"  # RERA 2026: verified, pending, flagged
    trakheesi_permit: str = ""  # RERA permit number if applicable
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    language_preference: Optional[str] = None
    property_interests: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    stage: Optional[str] = None
    probability: Optional[int] = None
    lead_source: Optional[str] = None
    estimated_deal_value: Optional[float] = None

# ==================== PROPERTY & CONTENT MODELS ====================

class PropertyCreate(BaseModel):
    title: str
    location: str
    bedrooms: int
    bathrooms: int
    price: float
    currency: str = "AED"
    amenities: List[str] = []
    description: str = ""
    property_type: str = "Apartment"
    area_sqft: int = 0
    images: List[str] = []

class Property(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str = ""  # MULTI-TENANT: User who owns this property
    title: str
    location: str
    bedrooms: int
    bathrooms: int
    price: float
    currency: str = "AED"
    amenities: List[str] = []
    description: str = ""
    property_type: str = "Apartment"
    area_sqft: int = 0
    images: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ContentRequest(BaseModel):
    property_id: str
    platforms: List[str] = ["instagram", "facebook", "whatsapp", "email", "seo"]
    languages: List[str] = ["English", "Arabic", "Hindi", "Russian", "Mandarin", "French"]

class GeneratedContent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str = ""  # MULTI-TENANT: User who owns this content
    property_id: str
    platform: str
    language: str
    content: str
    hashtags: str = ""
    approved: bool = False
    compliance_status: str = "pending"  # NEW: pending, approved, flagged
    compliance_flags: List[str] = []  # NEW: List of compliance issues
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ContentApproval(BaseModel):
    content_id: str
    approved: bool

# ==================== MESSAGING MODELS ====================

class WhatsAppMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str = ""  # MULTI-TENANT: User who owns this message
    lead_id: str
    lead_phone: str = ""  # NEW: Store phone for Twilio
    message: str
    language: str
    message_type: str
    status: str = "draft"  # draft, approved, sent, delivered, failed
    twilio_sid: str = ""  # NEW: Twilio message SID
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EmailMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str = ""  # MULTI-TENANT: User who owns this message
    lead_id: str
    lead_email: str = ""
    subject: str
    body: str
    language: str
    message_type: str
    status: str = "draft"  # draft, approved, sent, delivered, failed
    sendgrid_id: str = ""  # NEW: SendGrid message ID
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== VOICE AI MODELS ====================

class VoiceCallRequest(BaseModel):
    lead_id: str
    language: str = "English"

class VoiceCallWebhook(BaseModel):
    event: str
    call: Dict[str, Any]

# ==================== ACTIVITY & COMPLIANCE MODELS ====================

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str
    entity_type: str
    entity_id: str
    user_id: str = ""
    details: Dict[str, Any] = {}
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ComplianceAudit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content_id: str
    content_type: str  # generated_content, whatsapp, email
    original_content: str
    flags: List[str] = []
    ai_disclaimer_present: bool = False
    reviewed_by: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== OMNICHANNEL OUTREACH MODELS ====================

class OutreachSequence(BaseModel):
    """Omnichannel outreach sequence: Voice → WhatsApp → SMS → Email"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    owner_id: str = ""
    status: str = "active"  # active, paused, completed, cancelled
    current_step: str = "voice"  # voice, whatsapp, sms, email, completed
    
    # Step timings (in minutes from sequence start)
    voice_at: int = 0
    whatsapp_at: int = 2
    sms_at: int = 10
    email_at: int = 60
    
    # Step results
    voice_status: str = ""  # initiated, completed, no_answer, failed
    voice_call_id: str = ""
    whatsapp_status: str = ""  # sent, delivered, failed
    whatsapp_sid: str = ""
    sms_status: str = ""  # sent, delivered, failed
    sms_sid: str = ""
    email_status: str = ""  # sent, delivered, failed
    email_id: str = ""
    
    # Timestamps
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    next_action_at: str = ""
    completed_at: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OutreachSequenceCreate(BaseModel):
    lead_id: str
    voice_at: int = 0
    whatsapp_at: int = 2
    sms_at: int = 10
    email_at: int = 60

# ==================== FOLLOW-UP CADENCE MODELS ====================

class FollowUpCadence(BaseModel):
    """Automated follow-up cadence: Day 1 → Day 2 → Day 4 → Day 7"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    owner_id: str = ""
    status: str = "active"  # active, paused, completed, cancelled, responded
    trigger_reason: str = ""  # missed_call, no_response, callback_requested
    
    # Cadence schedule (days from start)
    day_1_action: str = "voice"  # Initial missed call
    day_2_action: str = "whatsapp"
    day_4_action: str = "voice"
    day_7_action: str = "email"  # Final outreach
    
    # Step completion status
    day_1_completed: bool = False
    day_1_result: str = ""
    day_2_completed: bool = False
    day_2_result: str = ""
    day_4_completed: bool = False
    day_4_result: str = ""
    day_7_completed: bool = False
    day_7_result: str = ""
    
    # Timestamps
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    next_action_at: str = ""
    next_action_day: int = 1
    completed_at: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== LEARNING ENGINE MODELS ====================

class ConversationLog(BaseModel):
    """Learning engine: Track Maya conversations with outcomes"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    owner_id: str = ""
    call_id: str = ""
    
    # Conversation data
    transcript: str = ""
    summary: str = ""
    duration_seconds: float = 0
    language: str = "English"
    
    # BANT extraction
    bant_budget: str = ""
    bant_authority: str = ""
    bant_need: str = ""
    bant_timeline: str = ""
    
    # Outcomes
    outcome: str = ""  # qualified, not_qualified, callback, no_answer, voicemail
    deal_status: str = ""  # pending, won, lost
    deal_closed_at: str = ""
    deal_value: float = 0
    
    # Broker rating (1-5 stars)
    broker_rating: int = 0
    broker_feedback: str = ""
    
    # AI learning data
    ai_confidence: int = 0
    objections_raised: List[str] = []
    successful_responses: List[str] = []
    improvement_suggestions: List[str] = []
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BrokerRating(BaseModel):
    conversation_id: str
    rating: int  # 1-5 stars
    feedback: str = ""
    deal_status: str = ""  # pending, won, lost
    deal_value: float = 0

class LearningPattern(BaseModel):
    """Detected patterns from Maya's conversations"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pattern_type: str  # objection, success_phrase, budget_range, timeline_indicator
    pattern_text: str
    frequency: int = 1
    success_rate: float = 0
    contexts: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== AUTHENTICATION HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash. Returns False if hash is empty/invalid."""
    if not hashed or len(hashed) < 10:
        # No password hash means OAuth-only user, can't login with password
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError) as e:
        logging.error(f"Password verification error: {e}")
        return False

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """
    Get current user from JWT token or session token.
    
    Auth methods supported:
    1. JWT Bearer token (preferred - created during login/signup/oauth)
    2. Session token in Authorization header (legacy OAuth users - will be phased out)
    3. Session token in cookie (fallback)
    """
    # Try Authorization header first
    if credentials and credentials.credentials:
        token = credentials.credentials
        
        # Try 1: Decode as JWT token (primary method)
        try:
            payload = decode_jwt_token(token)
            # SECURITY: Exclude password_hash from user data
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0, "password_hash": 0})
            if user:
                return user
        except:
            pass
        
        # Try 2: Check if it's a valid session token (for legacy OAuth users)
        # This handles users who logged in via OAuth before the JWT fix
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if session:
            expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                # SECURITY: Exclude password_hash from user data
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
    
    # Try 3: Session cookie (fallback for cookie-based auth)
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                # SECURITY: Exclude password_hash from user data
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
    
    return None

async def require_auth(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Require authentication - raises 401 if not authenticated"""
    user = await get_current_user(request, credentials)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

# ==================== AI HELPER FUNCTIONS ====================

async def get_llm_chat(session_id: str, system_message: str):
    """Initialize Claude chat with Emergent key"""
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    return chat

async def score_lead_with_ai(lead_data: dict) -> dict:
    """Use Claude to score a lead and generate briefing"""
    system_message = """You are an expert Dubai real estate lead qualification specialist.
    Score leads from 1-10 based on:
    - Budget alignment with Dubai market (8-10: >5M AED, 6-7: 2-5M AED, 1-5: <2M AED)
    - Property interest specificity (detailed = higher score)
    - Location preference (prime areas like Downtown, Palm = higher)
    - Timeline urgency
    - Communication responsiveness
    
    Return JSON only with: {"score": number, "reasoning": "brief explanation", "ai_briefing": "3-4 bullet points for agent", "category": "hot/warm/cold"}
    Hot: 8-10, Warm: 6-7, Cold: 1-5"""
    
    try:
        chat = await get_llm_chat(f"lead-scoring-{uuid.uuid4()}", system_message)
        prompt = f"""Score this lead:
Name: {lead_data.get('name', 'Unknown')}
Email: {lead_data.get('email', 'N/A')}
Phone: {lead_data.get('phone', 'N/A')}
Language: {lead_data.get('language_preference', 'English')}
Property Interests: {json.dumps(lead_data.get('property_interests', {}))}
Notes: {lead_data.get('notes', 'No notes')}
Lead Source: {lead_data.get('lead_source', 'Unknown')}
Estimated Deal Value: {lead_data.get('estimated_deal_value', 0)} AED

Return valid JSON only."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        result = json.loads(response_text)
        if isinstance(result.get('ai_briefing'), list):
            result['ai_briefing'] = '\n• '.join(result['ai_briefing'])
        return result
    except Exception as e:
        logging.error(f"Lead scoring error: {e}")
        return {"score": 5, "reasoning": "Manual review needed", "ai_briefing": "Unable to auto-score. Please review manually.", "category": "warm"}

# ==================== RERA/DLD COMPLIANCE VALIDATION ====================

RERA_VIOLATION_PATTERNS = [
    (r'guaranteed?\s*(\d+%?\s*)?roi', 'Investment return guarantee'),
    (r'guaranteed?\s*return', 'Investment return guarantee'),
    (r'prices?\s*will\s*(double|triple|increase)', 'Price appreciation promise'),
    (r'(\d+%?\s*)?appreciation\s*guaranteed', 'Appreciation guarantee'),
    (r'risk[- ]?free\s*investment', 'Risk-free investment claim'),
    (r'cannot\s*lose\s*money', 'Cannot lose claim'),
    (r'best\s*investment\s*(ever|in\s*dubai)', 'Superlative investment claim'),
    (r'100%\s*safe', 'Safety guarantee'),
    (r'prices?\s*never\s*fall', 'Price stability guarantee'),
]

def validate_rera_compliance(content: str) -> tuple[bool, List[str]]:
    """
    Validate content for RERA/DLD compliance.
    Returns (is_compliant, list_of_violations)
    """
    violations = []
    content_lower = content.lower()
    
    for pattern, violation_type in RERA_VIOLATION_PATTERNS:
        if re.search(pattern, content_lower):
            violations.append(violation_type)
    
    # Check for AI disclaimer
    has_disclaimer = '[ai-generated' in content_lower or '[ai-assisted' in content_lower or 'ai-generated content' in content_lower
    
    if not has_disclaimer:
        violations.append('Missing AI-generated content disclaimer')
    
    is_compliant = len(violations) == 0
    return is_compliant, violations

async def generate_content_with_ai(property_data: dict, platform: str, language: str) -> dict:
    """Generate marketing content for a property in specified language with RERA compliance"""
    
    platform_specs = {
        "instagram": "150 characters max caption + relevant hashtags. Engaging, visual-focused.",
        "facebook": "300 words ad copy. Persuasive, detailed benefits.",
        "whatsapp": "100 words broadcast message. Personal, direct, call-to-action.",
        "email": "250 words email snippet. Professional, informative.",
        "seo": "400 words property description. SEO-optimized, detailed features."
    }
    
    system_message = f"""You are a multilingual Dubai real estate marketing specialist.
    Generate content in {language} for {platform}.
    Requirements: {platform_specs.get(platform, 'Professional marketing copy')}
    
    CRITICAL RERA/DLD COMPLIANCE RULES:
    1. NEVER make investment return guarantees (no "guaranteed ROI", "guaranteed returns")
    2. NEVER promise price appreciation ("prices will double", "values always increase")
    3. NEVER use risk-free language ("cannot lose money", "100% safe investment")
    4. ALWAYS include "[AI-Generated Content]" disclaimer at the end
    5. Focus on property features, lifestyle, and location benefits only
    
    For Arabic: Use proper Modern Standard Arabic with correct diacritics.
    
    Return JSON only: {{"content": "main text", "hashtags": "relevant hashtags if applicable"}}"""
    
    try:
        chat = await get_llm_chat(f"content-gen-{uuid.uuid4()}", system_message)
        prompt = f"""Generate {platform} content in {language} for this Dubai property:

Title: {property_data.get('title', 'Luxury Property')}
Location: {property_data.get('location', 'Dubai')}
Type: {property_data.get('property_type', 'Apartment')}
Bedrooms: {property_data.get('bedrooms', 0)}
Bathrooms: {property_data.get('bathrooms', 0)}
Price: {property_data.get('price', 0)} {property_data.get('currency', 'AED')}
Area: {property_data.get('area_sqft', 0)} sqft
Amenities: {', '.join(property_data.get('amenities', []))}
Description: {property_data.get('description', '')}

IMPORTANT: Include "[AI-Generated Content]" at the end. Do NOT make any investment guarantees.
Return valid JSON only."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        result = json.loads(response_text)
        
        # Ensure AI disclaimer is present
        content = result.get("content", "")
        if "[AI-Generated Content]" not in content and "[AI-Assisted Content]" not in content:
            content += "\n\n[AI-Generated Content]"
            result["content"] = content
        
        return result
    except Exception as e:
        logging.error(f"Content generation error: {e}")
        return {"content": f"[Error generating content: {str(e)}]", "hashtags": ""}

async def generate_whatsapp_message(lead_data: dict, message_type: str, language: str) -> str:
    """Generate personalized WhatsApp message"""
    
    message_templates = {
        "reminder": "Generate a friendly 24-hour viewing reminder",
        "confirmation": "Generate a 2-hour viewing confirmation message",
        "follow_up": "Generate a post-viewing follow-up message",
        "nurture": "Generate a lead nurture message for cold leads"
    }
    
    system_message = f"""You are a Dubai real estate agent assistant.
    Generate a {message_templates.get(message_type, 'professional')} in {language}.
    Keep it personal, professional, and under 100 words.
    Include agent's name placeholder [AGENT_NAME] and property placeholder [PROPERTY].
    IMPORTANT: Include "[AI-Assisted Content]" at the end for compliance.
    Return plain text only, no JSON."""
    
    try:
        chat = await get_llm_chat(f"whatsapp-{uuid.uuid4()}", system_message)
        prompt = f"""Generate message for:
Lead Name: {lead_data.get('name', 'Valued Client')}
Language: {language}
Message Type: {message_type}

Return plain text message only. Include [AI-Assisted Content] at the end."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        result = response.strip()
        
        # Ensure compliance disclaimer
        if "[AI-Assisted Content]" not in result and "[AI-Generated Content]" not in result:
            result += "\n\n[AI-Assisted Content]"
        
        return result
    except Exception as e:
        logging.error(f"WhatsApp message error: {e}")
        return f"[Unable to generate message: {str(e)}]"

# ==================== MESSAGING SERVICE HANDLERS ====================

async def send_twilio_whatsapp(to_phone: str, message: str) -> dict:
    """Send WhatsApp message via Twilio API (plug-and-play)"""
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_WHATSAPP_NUMBER')
    
    if not all([account_sid, auth_token, from_number]):
        # Return simulated response if credentials not configured
        return {
            "status": "simulated",
            "sid": f"SIM_{uuid.uuid4().hex[:16]}",
            "message": "Twilio credentials not configured. Message simulated."
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                auth=(account_sid, auth_token),
                data={
                    "From": f"whatsapp:{from_number}",
                    "To": f"whatsapp:{to_phone}",
                    "Body": message
                }
            )
            result = response.json()
            return {
                "status": "sent",
                "sid": result.get("sid", ""),
                "message": "Message sent successfully"
            }
    except Exception as e:
        logging.error(f"Twilio WhatsApp error: {e}")
        return {"status": "failed", "sid": "", "message": str(e)}

async def send_sendgrid_email(to_email: str, subject: str, body: str) -> dict:
    """Send email via SendGrid API (plug-and-play)"""
    api_key = os.environ.get('SENDGRID_API_KEY')
    from_email = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@propboost.ai')
    
    if not api_key:
        # Return simulated response if credentials not configured
        return {
            "status": "simulated",
            "message_id": f"SIM_{uuid.uuid4().hex[:16]}",
            "message": "SendGrid API key not configured. Email simulated."
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": from_email, "name": "PropBoost AI"},
                    "subject": subject,
                    "content": [{"type": "text/html", "value": body}]
                }
            )
            if response.status_code in [200, 202]:
                return {
                    "status": "sent",
                    "message_id": response.headers.get("X-Message-Id", ""),
                    "message": "Email sent successfully"
                }
            else:
                return {"status": "failed", "message_id": "", "message": response.text}
    except Exception as e:
        logging.error(f"SendGrid email error: {e}")
        return {"status": "failed", "message_id": "", "message": str(e)}

async def send_twilio_sms(to_phone: str, message: str) -> dict:
    """Send SMS via Twilio API"""
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
    from_number = os.environ.get('TWILIO_PHONE_NUMBER')
    
    if not all([account_sid, auth_token, from_number]):
        # Return simulated response if credentials not configured
        return {
            "status": "simulated",
            "sid": f"SIM_SMS_{uuid.uuid4().hex[:16]}",
            "message": "Twilio credentials not configured. SMS simulated."
        }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                auth=(account_sid, auth_token),
                data={
                    "From": from_number,
                    "To": to_phone,
                    "Body": message
                }
            )
            result = response.json()
            if response.status_code in [200, 201]:
                return {
                    "status": "sent",
                    "sid": result.get("sid", ""),
                    "message": "SMS sent successfully"
                }
            else:
                return {"status": "failed", "sid": "", "message": result.get("message", "Unknown error")}
    except Exception as e:
        logging.error(f"Twilio SMS error: {e}")
        return {"status": "failed", "sid": "", "message": str(e)}

async def send_simulated_email(to_email: str, subject: str, body: str, lead_name: str = "") -> dict:
    """Simulated email sending (logs to database)"""
    email_id = f"EMAIL_{uuid.uuid4().hex[:16]}"
    
    # Store in database for tracking
    await db.simulated_emails.insert_one({
        "id": email_id,
        "to_email": to_email,
        "subject": subject,
        "body": body,
        "lead_name": lead_name,
        "status": "simulated",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logging.info(f"[SIMULATED EMAIL] To: {to_email}, Subject: {subject}")
    
    return {
        "status": "simulated",
        "message_id": email_id,
        "message": "Email simulated (SendGrid not configured). Logged for tracking."
    }

# ==================== VOICE AI (VAPI) SERVICE ====================

async def trigger_maya_call(lead: dict, language: str = "English") -> dict:
    """Trigger Maya voice AI call via Vapi AI"""
    api_key = os.environ.get('VAPI_API_KEY')
    assistant_id = os.environ.get('VAPI_ASSISTANT_ID')
    phone_number_id = os.environ.get('VAPI_PHONE_NUMBER_ID')
    
    if not all([api_key, assistant_id, phone_number_id]):
        return {
            "status": "simulated",
            "call_id": f"SIM_CALL_{uuid.uuid4().hex[:12]}",
            "message": "Vapi AI credentials not configured. Call simulated."
        }
    
    # Determine language code
    lang_code = "ar" if language.lower() == "arabic" else "hi" if language.lower() == "hindi" else "en"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.vapi.ai/call",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "assistantId": assistant_id,
                    "phoneNumberId": phone_number_id,
                    "customer": {
                        "number": lead.get("phone", ""),
                        "name": lead.get("name", "Customer")
                    },
                    "assistantOverrides": {
                        "variableValues": {
                            "customer_name": lead.get("name", ""),
                            "language": lang_code,
                            "budget_range": lead.get("property_interests", {}).get("budget", ""),
                            "location_preference": lead.get("property_interests", {}).get("location", "")
                        }
                    },
                    "metadata": {
                        "lead_id": lead.get("id", ""),
                        "lead_name": lead.get("name", ""),
                        "language": language
                    }
                },
                timeout=30.0
            )
            result = response.json()
            
            # Handle Vapi API errors
            if response.status_code >= 400 or result.get("error"):
                error_msg = result.get("message") or result.get("error") or f"HTTP {response.status_code}"
                logging.warning(f"Vapi API error: {error_msg}")
                return {
                    "status": "failed",
                    "call_id": "",
                    "message": f"Vapi error: {error_msg}"
                }
            
            return {
                "status": "initiated",
                "call_id": result.get("id", ""),
                "message": "Maya call initiated successfully via Vapi"
            }
    except Exception as e:
        logging.error(f"Vapi AI call error: {e}")
        return {"status": "failed", "call_id": "", "message": str(e)}

# ==================== ACTIVITY LOGGING ====================

async def log_activity(action: str, entity_type: str, entity_id: str, details: dict, user_id: str = ""):
    """Log an activity for compliance audit trail"""
    log = ActivityLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        details=details
    )
    await db.activity_logs.insert_one(log.model_dump())

async def create_compliance_audit(content_id: str, content_type: str, content: str, flags: List[str], user_id: str = ""):
    """Create compliance audit record"""
    audit = ComplianceAudit(
        content_id=content_id,
        content_type=content_type,
        original_content=content,
        flags=flags,
        ai_disclaimer_present="[AI-" in content,
        reviewed_by=user_id
    )
    await db.compliance_audits.insert_one(audit.model_dump())

# ==================== AUTHENTICATION ENDPOINTS ====================

@auth_router.post("/signup")
async def signup(user_data: UserCreate):
    """Register a new user"""
    logging.info(f"Signup attempt for: {user_data.email}")
    
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        logging.warning(f"Signup failed: Email already exists - {user_data.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        company=user_data.company,
        phone=user_data.phone
    )
    
    # Store with hashed password
    user_doc = user.model_dump()
    user_doc["password_hash"] = hash_password(user_data.password)
    
    try:
        await db.users.insert_one(user_doc)
        logging.info(f"User created successfully: {user_data.email}")
    except Exception as e:
        logging.error(f"Database error during signup: {e}")
        raise HTTPException(status_code=500, detail="Failed to create account")
    
    # Generate JWT token
    token = create_jwt_token(user.user_id, user.email)
    
    await log_activity("user_signup", "user", user.user_id, {"email": user.email})
    
    return {
        "user": {k: v for k, v in user.model_dump().items()},
        "token": token,
        "message": "Account created successfully"
    }

@auth_router.post("/login")
async def login(credentials: UserLogin):
    """Login with email/password"""
    logging.info(f"Login attempt for: {credentials.email}")
    
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        logging.warning(f"Login failed: User not found - {credentials.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user has password (OAuth users don't)
    if not user_doc.get("password_hash"):
        logging.warning(f"Login failed: OAuth-only user tried password login - {credentials.email}")
        raise HTTPException(
            status_code=401, 
            detail="This account uses Google Sign-In. Please use the 'Continue with Google' button."
        )
    
    if not verify_password(credentials.password, user_doc.get("password_hash", "")):
        logging.warning(f"Login failed: Invalid password - {credentials.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user_doc["user_id"], user_doc["email"])
    
    await log_activity("user_login", "user", user_doc["user_id"], {"method": "password"})
    logging.info(f"Login successful: {credentials.email}")
    
    # Remove password hash from response
    user_doc.pop("password_hash", None)
    
    return {
        "user": user_doc,
        "token": token,
        "message": "Login successful"
    }

@auth_router.get("/session")
async def get_session_data(request: Request):
    """Exchange session_id for user data (Google OAuth callback)"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            oauth_data = response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one({"email": oauth_data["email"]}, {"_id": 0})
            
            if existing_user:
                user_id = existing_user["user_id"]
                # Update user info if needed
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "name": oauth_data.get("name", existing_user.get("name")),
                        "picture": oauth_data.get("picture", existing_user.get("picture"))
                    }}
                )
            else:
                # Create new user
                user = User(
                    email=oauth_data["email"],
                    name=oauth_data.get("name", ""),
                    picture=oauth_data.get("picture", "")
                )
                user_id = user.user_id
                await db.users.insert_one(user.model_dump())
            
            # FIX: Create a proper JWT token for OAuth users (same as email/password login)
            # This allows them to access protected API endpoints
            user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
            jwt_token = create_jwt_token(user_id, user_doc["email"])
            
            # Also store session for cookie-based auth (optional fallback)
            expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            session = UserSession(
                user_id=user_id,
                session_token=jwt_token,  # Store JWT as session token
                expires_at=expires_at
            )
            
            # Upsert session
            await db.user_sessions.update_one(
                {"user_id": user_id},
                {"$set": session.model_dump()},
                upsert=True
            )
            
            await log_activity("user_login", "user", user_id, {"method": "google_oauth"})
            
            logging.info(f"OAuth login successful for: {user_doc['email']}")
            
            return {
                "user": user_doc,
                "session_token": jwt_token,  # Return JWT token for API access
                "expires_at": expires_at
            }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"OAuth session error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@auth_router.get("/me")
async def get_me(user: dict = Depends(require_auth)):
    """Get current authenticated user"""
    return user

@auth_router.post("/logout")
async def logout(request: Request, response: Response, user: dict = Depends(require_auth)):
    """Logout user"""
    # Delete session
    await db.user_sessions.delete_one({"user_id": user["user_id"]})
    
    # Clear cookie
    response.delete_cookie("session_token")
    
    await log_activity("user_logout", "user", user["user_id"], {})
    
    return {"message": "Logged out successfully"}

@auth_router.post("/password-reset")
async def request_password_reset(data: PasswordReset):
    """Request password reset"""
    user = await db.users.find_one({"email": data.email})
    if not user:
        # Don't reveal if user exists
        return {"message": "If the email exists, a reset link will be sent"}
    
    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    
    await db.password_resets.insert_one({
        "user_id": user["user_id"],
        "token": reset_token,
        "expires_at": expires_at,
        "used": False
    })
    
    # In production, send email with reset link
    # For now, return token (would be sent via email)
    await log_activity("password_reset_requested", "user", user["user_id"], {})
    
    return {
        "message": "If the email exists, a reset link will be sent",
        "debug_token": reset_token  # Remove in production
    }

@auth_router.post("/password-reset/confirm")
async def confirm_password_reset(data: PasswordResetConfirm):
    """Confirm password reset with token"""
    reset = await db.password_resets.find_one({
        "token": data.token,
        "used": False
    })
    
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    expires_at = datetime.fromisoformat(reset["expires_at"].replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expired")
    
    # Update password
    new_hash = hash_password(data.new_password)
    await db.users.update_one(
        {"user_id": reset["user_id"]},
        {"$set": {"password_hash": new_hash}}
    )
    
    # Mark token as used
    await db.password_resets.update_one(
        {"token": data.token},
        {"$set": {"used": True}}
    )
    
    await log_activity("password_reset_completed", "user", reset["user_id"], {})
    
    return {"message": "Password reset successful"}

# ==================== LEAD ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "PropBoost AI API", "version": "2.0.0"}

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_input: LeadCreate, user: dict = Depends(require_auth)):
    """Create a new lead and score with AI - MULTI-TENANT: Lead is owned by current user"""
    lead = Lead(**lead_input.model_dump())
    
    # MULTI-TENANT: Set owner to current user
    lead.owner_id = user["user_id"]
    
    # Score lead with AI
    score_result = await score_lead_with_ai(lead.model_dump())
    lead.score = score_result.get("score", 5)
    lead.score_reasoning = score_result.get("reasoning", "")
    lead.ai_briefing = score_result.get("ai_briefing", "")
    
    # Set stage based on score
    if lead.score >= 8:
        lead.stage = "qualified"
        lead.probability = 60
    elif lead.score >= 6:
        lead.stage = "new"
        lead.probability = 30
    else:
        lead.stage = "new"
        lead.probability = 10
    
    # Trigger Maya call for hot leads (score > 7) BEFORE saving
    if lead.score > 7:
        logging.info(f"Hot lead detected (score={lead.score}), triggering Maya call for {lead.name}")
        maya_result = await trigger_maya_call(lead.model_dump(), lead.language_preference)
        lead.maya_call_status = maya_result["status"]
        lead.maya_call_id = maya_result["call_id"]
        logging.info(f"Maya call result: {maya_result}")
        await log_activity("maya_call_triggered", "lead", lead.id, maya_result, user.get("user_id", ""))
    
    doc = lead.model_dump()
    await db.leads.insert_one(doc)
    
    await log_activity("lead_created", "lead", lead.id, {"score": lead.score}, user.get("user_id", ""))
    
    return lead

async def trigger_maya_call_background(lead_data: dict, language: str):
    """Background task to trigger Maya voice AI call (deprecated - now inline)"""
    pass

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    stage: Optional[str] = None, 
    score_min: Optional[int] = None, 
    score_max: Optional[int] = None,
    lead_source: Optional[str] = None,
    user: dict = Depends(require_auth)
):
    """Get all leads with optional filters - MULTI-TENANT: Only returns user's own leads"""
    # MULTI-TENANT: Filter by owner_id
    query = {"owner_id": user["user_id"]}
    if stage:
        query["stage"] = stage
    if score_min is not None:
        query["score"] = {"$gte": score_min}
    if score_max is not None:
        query.setdefault("score", {})["$lte"] = score_max
    if lead_source:
        query["lead_source"] = lead_source
    
    leads = await db.leads.find(query, {"_id": 0}).to_list(1000)
    
    # Clean up legacy data
    cleaned_leads = []
    for lead in leads:
        if isinstance(lead.get('ai_briefing'), list):
            lead['ai_briefing'] = '\n• '.join(lead['ai_briefing'])
        cleaned_leads.append(lead)
    
    return cleaned_leads

@api_router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str, user: dict = Depends(require_auth)):
    """Get a single lead by ID - MULTI-TENANT: Only returns if user owns the lead"""
    # MULTI-TENANT: Filter by owner_id
    lead = await db.leads.find_one({"id": lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate, user: dict = Depends(require_auth)):
    """Update a lead - MULTI-TENANT: Only updates if user owns the lead"""
    update_data = {k: v for k, v in lead_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # MULTI-TENANT: Filter by owner_id
    result = await db.leads.update_one({"id": lead_id, "owner_id": user["user_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    await log_activity("lead_updated", "lead", lead_id, update_data, user.get("user_id", ""))
    return lead

@api_router.post("/leads/{lead_id}/rescore", response_model=Lead)
async def rescore_lead(lead_id: str, user: dict = Depends(require_auth)):
    """Rescore an existing lead with AI - MULTI-TENANT: Only rescores if user owns the lead"""
    # MULTI-TENANT: Filter by owner_id
    lead = await db.leads.find_one({"id": lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    score_result = await score_lead_with_ai(lead)
    update_data = {
        "score": score_result.get("score", lead["score"]),
        "score_reasoning": score_result.get("reasoning", ""),
        "ai_briefing": score_result.get("ai_briefing", ""),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    await log_activity("lead_rescored", "lead", lead_id, {"new_score": update_data["score"]}, user.get("user_id", ""))
    return lead

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(require_auth)):
    """Delete a lead - MULTI-TENANT: Only deletes if user owns the lead"""
    # MULTI-TENANT: Filter by owner_id
    result = await db.leads.delete_one({"id": lead_id, "owner_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    await log_activity("lead_deleted", "lead", lead_id, {}, user.get("user_id", ""))
    return {"message": "Lead deleted successfully"}

# ==================== VOICE AI ENDPOINTS ====================

@api_router.post("/voice/trigger-call")
async def trigger_voice_call(request: VoiceCallRequest, user: dict = Depends(require_auth)):
    """Manually trigger Maya voice AI call for a lead - MULTI-TENANT: Only for user's own leads"""
    # MULTI-TENANT: Filter by owner_id
    lead = await db.leads.find_one({"id": request.lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    result = await trigger_maya_call(lead, request.language)
    
    if result["status"] in ["initiated", "simulated"]:
        await db.leads.update_one(
            {"id": request.lead_id},
            {"$set": {
                "maya_call_status": result["status"],
                "maya_call_id": result["call_id"]
            }}
        )
    
    await log_activity("maya_call_manual", "lead", request.lead_id, result, user.get("user_id", ""))
    
    return result

@api_router.post("/voice/webhook")
async def voice_call_webhook(request: Request):
    """Handle Vapi AI webhook events"""
    try:
        payload = await request.json()
        
        # Vapi sends different event types
        message = payload.get("message", {})
        event_type = message.get("type", "")
        call_data = message.get("call", {}) or payload.get("call", {})
        lead_id = call_data.get("metadata", {}).get("lead_id", "")
        
        logging.info(f"Vapi webhook received: {event_type}")
        
        if event_type == "end-of-call-report" and lead_id:
            # Extract call results
            artifact = message.get("artifact", {})
            transcript = artifact.get("transcript", "")
            recording_url = artifact.get("recordingUrl", "")
            ended_reason = message.get("endedReason", "")
            summary = artifact.get("summary", "")
            
            # Calculate call duration
            duration_seconds = 0
            if call_data.get("startedAt") and call_data.get("endedAt"):
                try:
                    start = datetime.fromisoformat(call_data["startedAt"].replace("Z", "+00:00"))
                    end = datetime.fromisoformat(call_data["endedAt"].replace("Z", "+00:00"))
                    duration_seconds = (end - start).total_seconds()
                except:
                    pass
            
            # Parse BANT data from transcript/summary using AI
            bant_data = await extract_bant_from_call(transcript, summary)
            
            # Calculate confidence score based on confirmed data points
            confidence_score = calculate_confidence_score(bant_data, ended_reason, duration_seconds)
            
            update_data = {
                "maya_call_status": "completed",
                "maya_call_summary": summary,
                "maya_recording_url": recording_url,
                "maya_bant": bant_data,
                "maya_confidence_score": confidence_score,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Update property interests with BANT data if available
            if bant_data.get("budget"):
                lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
                if lead:
                    interests = lead.get("property_interests", {})
                    if bant_data.get("budget"):
                        interests["budget"] = bant_data["budget"]
                    if bant_data.get("location"):
                        interests["location"] = bant_data["location"]
                    update_data["property_interests"] = interests
            
            await db.leads.update_one({"id": lead_id}, {"$set": update_data})
            
            # Log call details
            await db.voice_call_logs.insert_one({
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "call_id": call_data.get("id", ""),
                "transcript": transcript,
                "summary": summary,
                "recording_url": recording_url,
                "ended_reason": ended_reason,
                "duration_seconds": duration_seconds,
                "bant_data": bant_data,
                "confidence_score": confidence_score,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            await log_activity("maya_call_completed", "lead", lead_id, {
                "call_id": call_data.get("id"),
                "ended_reason": ended_reason,
                "confidence_score": confidence_score
            })
            
            logging.info(f"Call completed for lead {lead_id}: {ended_reason}, confidence: {confidence_score}%")
        
        elif event_type == "status-update":
            status = message.get("status", "")
            if lead_id and status:
                await db.leads.update_one(
                    {"id": lead_id},
                    {"$set": {"maya_call_status": status}}
                )
                logging.info(f"Call status update for lead {lead_id}: {status}")
        
        return {"status": "received"}
    except Exception as e:
        logging.error(f"Voice webhook error: {e}")
        return {"status": "error", "message": str(e)}

async def extract_bant_from_call(transcript: str, summary: str) -> dict:
    """Extract BANT qualification data from call transcript using AI"""
    if not transcript and not summary:
        return {}
    
    try:
        system_message = """You are a sales qualification analyst. Extract BANT data from this call.
        Return JSON only with these fields:
        {
            "budget": "extracted budget range or null",
            "authority": "decision maker status: yes/no/unknown",
            "need": "property need description or null",
            "timeline": "purchase timeline or null",
            "location": "preferred location or null",
            "property_type": "villa/apartment/penthouse or null",
            "interest_level": "high/medium/low/unknown",
            "next_steps": "agreed next steps or null",
            "objections": "any objections raised or null"
        }"""
        
        chat = await get_llm_chat(f"bant-extract-{uuid.uuid4()}", system_message)
        prompt = f"""Extract BANT qualification data from this call:

TRANSCRIPT:
{transcript[:3000]}

SUMMARY:
{summary}

Return valid JSON only."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        return json.loads(response_text)
    except Exception as e:
        logging.error(f"BANT extraction error: {e}")
        return {}

def calculate_confidence_score(bant_data: dict, ended_reason: str, duration_seconds: float) -> int:
    """Calculate AI confidence score based on confirmed data points"""
    score = 0
    max_score = 100
    
    # Call completion quality (30 points)
    if ended_reason in ["customer-ended-call", "agent-ended-call", "assistant-ended-call"]:
        score += 20
        if duration_seconds > 60:
            score += 10  # Good conversation length
    elif ended_reason == "voicemail":
        score += 5
    
    # BANT data completeness (70 points)
    if bant_data:
        # Budget confirmed (20 points)
        if bant_data.get("budget") and bant_data.get("budget") != "null":
            score += 20
        
        # Authority confirmed (15 points)
        if bant_data.get("authority") == "yes":
            score += 15
        elif bant_data.get("authority") == "unknown":
            score += 5
        
        # Need identified (15 points)
        if bant_data.get("need") and bant_data.get("need") != "null":
            score += 15
        
        # Timeline confirmed (10 points)
        if bant_data.get("timeline") and bant_data.get("timeline") != "null":
            score += 10
        
        # Interest level (10 points)
        interest = bant_data.get("interest_level", "").lower()
        if interest == "high":
            score += 10
        elif interest == "medium":
            score += 5
    
    return min(score, max_score)


@api_router.get("/voice/stats")
async def get_voice_stats(user: dict = Depends(require_auth)):
    """Get Voice AI Maya statistics for dashboard - MULTI-TENANT: Only user's own data"""
    try:
        # MULTI-TENANT: Filter by owner_id
        user_filter = {"owner_id": user["user_id"]}
        
        # Total calls made
        total_calls = await db.leads.count_documents({**user_filter, "maya_call_id": {"$exists": True, "$ne": ""}})
        
        # Calls by status
        calls_initiated = await db.leads.count_documents({**user_filter, "maya_call_status": "initiated"})
        calls_completed = await db.leads.count_documents({**user_filter, "maya_call_status": "completed"})
        calls_failed = await db.leads.count_documents({**user_filter, "maya_call_status": "failed"})
        
        # Get user's lead IDs
        user_leads = await db.leads.find(user_filter, {"id": 1, "_id": 0}).to_list(10000)
        user_lead_ids = [l["id"] for l in user_leads]
        
        # Get call logs for user's leads only
        call_logs = await db.voice_call_logs.find({"lead_id": {"$in": user_lead_ids}}, {"_id": 0}).to_list(1000)
        
        # Calculate answered vs not answered
        calls_answered = len([c for c in call_logs if c.get("ended_reason") not in ["no-answer", "busy", "failed", "machine-detected"]])
        calls_no_answer = len([c for c in call_logs if c.get("ended_reason") in ["no-answer", "busy"]])
        
        # Calculate average duration from completed calls
        durations = [c.get("duration_seconds", 0) for c in call_logs if c.get("duration_seconds")]
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        # Qualification results (parse from summaries or ended_reason)
        qualified_interested = 0
        qualified_not_interested = 0
        qualified_callback = 0
        qualified_unknown = 0
        
        for log in call_logs:
            summary = (log.get("summary") or "").lower()
            ended_reason = (log.get("ended_reason") or "").lower()
            
            if "interested" in summary and "not interested" not in summary:
                qualified_interested += 1
            elif "not interested" in summary or "declined" in summary:
                qualified_not_interested += 1
            elif "callback" in summary or "call back" in summary or "busy" in ended_reason:
                qualified_callback += 1
            elif log.get("ended_reason"):
                qualified_unknown += 1
        
        # Calculate qualification rate
        total_qualified = qualified_interested + qualified_not_interested + qualified_callback
        qualification_rate = round((qualified_interested / total_qualified * 100) if total_qualified > 0 else 0, 1)
        
        # Calculate average confidence score
        confidence_scores = [c.get("confidence_score", 0) for c in call_logs if c.get("confidence_score")]
        avg_confidence = round(sum(confidence_scores) / len(confidence_scores)) if confidence_scores else 0
        
        return {
            "total_calls": total_calls,
            "calls_initiated": calls_initiated,
            "calls_completed": calls_completed,
            "calls_answered": calls_answered,
            "calls_no_answer": calls_no_answer,
            "calls_failed": calls_failed,
            "avg_duration_seconds": round(avg_duration, 1),
            "avg_confidence": avg_confidence,
            "qualified_interested": qualified_interested,
            "qualified_not_interested": qualified_not_interested,
            "qualified_callback": qualified_callback,
            "qualified_unknown": qualified_unknown,
            "qualification_rate": qualification_rate
        }
    except Exception as e:
        logging.error(f"Error getting voice stats: {e}")
        return {
            "total_calls": 0,
            "calls_answered": 0,
            "calls_no_answer": 0,
            "calls_failed": 0,
            "avg_duration_seconds": 0,
            "avg_confidence": 0,
            "qualification_rate": 0,
            "qualified_interested": 0,
            "qualified_not_interested": 0,
            "qualified_callback": 0,
            "qualified_unknown": 0
        }

@api_router.get("/voice/call-logs")
async def get_voice_call_logs(limit: int = 20, user: dict = Depends(require_auth)):
    """Get recent voice call logs with lead details - MULTI-TENANT: Only user's own data"""
    try:
        # MULTI-TENANT: Get user's lead IDs first
        user_leads = await db.leads.find({"owner_id": user["user_id"]}, {"id": 1, "_id": 0}).to_list(10000)
        user_lead_ids = [l["id"] for l in user_leads]
        
        logs = await db.voice_call_logs.find({"lead_id": {"$in": user_lead_ids}}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        
        # Enrich with lead data
        enriched_logs = []
        for log in logs:
            lead_id = log.get("lead_id")
            if lead_id:
                lead = await db.leads.find_one({"id": lead_id}, {"_id": 0, "name": 1, "phone": 1})
                if lead:
                    log["lead_name"] = lead.get("name", "Unknown")
                    log["lead_phone"] = lead.get("phone", "")
            
            # Parse qualification result from summary
            summary = (log.get("summary") or "").lower()
            if "interested" in summary and "not interested" not in summary:
                log["qualification_result"] = "interested"
            elif "not interested" in summary:
                log["qualification_result"] = "not_interested"
            elif "callback" in summary or "call back" in summary:
                log["qualification_result"] = "callback"
            else:
                log["qualification_result"] = "unknown"
            
            # Determine status from ended_reason
            ended_reason = log.get("ended_reason", "")
            if ended_reason in ["customer-ended-call", "agent-ended-call", "assistant-ended-call"]:
                log["status"] = "completed"
            elif ended_reason in ["no-answer", "busy"]:
                log["status"] = "no-answer"
            elif ended_reason in ["failed", "error"]:
                log["status"] = "failed"
            else:
                log["status"] = "completed" if log.get("transcript") else "unknown"
            
            enriched_logs.append(log)
        
        return enriched_logs
    except Exception as e:
        logging.error(f"Error getting call logs: {e}")
        return []


# ==================== PROPERTY ENDPOINTS ====================

@api_router.post("/properties", response_model=Property)
async def create_property(property_input: PropertyCreate, user: dict = Depends(require_auth)):
    """Create a new property - MULTI-TENANT: Property is owned by current user"""
    property_obj = Property(**property_input.model_dump())
    # MULTI-TENANT: Set owner to current user
    property_obj.owner_id = user["user_id"]
    doc = property_obj.model_dump()
    await db.properties.insert_one(doc)
    await log_activity("property_created", "property", property_obj.id, {"title": property_obj.title}, user.get("user_id", ""))
    return property_obj

@api_router.get("/properties", response_model=List[Property])
async def get_properties(user: dict = Depends(require_auth)):
    """Get all properties - MULTI-TENANT: Only returns user's own properties"""
    # MULTI-TENANT: Filter by owner_id
    properties = await db.properties.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    return properties

@api_router.get("/properties/{property_id}", response_model=Property)
async def get_property(property_id: str, user: dict = Depends(require_auth)):
    """Get a single property - MULTI-TENANT: Only returns if user owns the property"""
    # MULTI-TENANT: Filter by owner_id
    property_obj = await db.properties.find_one({"id": property_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
    return property_obj

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(require_auth)):
    """Delete a property - MULTI-TENANT: Only deletes if user owns the property"""
    # MULTI-TENANT: Filter by owner_id
    result = await db.properties.delete_one({"id": property_id, "owner_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    return {"message": "Property deleted successfully"}

# ==================== CONTENT GENERATION ENDPOINTS ====================

@api_router.post("/content/generate")
async def generate_content(request: ContentRequest, user: dict = Depends(require_auth)):
    """Generate multilingual content for a property with RERA compliance check - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    property_obj = await db.properties.find_one({"id": request.property_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
    
    generated_contents = []
    
    for platform in request.platforms:
        for language in request.languages:
            content_result = await generate_content_with_ai(property_obj, platform, language)
            
            # Validate RERA compliance
            content_text = content_result.get("content", "")
            is_compliant, violations = validate_rera_compliance(content_text)
            
            content_obj = GeneratedContent(
                property_id=request.property_id,
                platform=platform,
                language=language,
                content=content_text,
                hashtags=content_result.get("hashtags", ""),
                compliance_status="approved" if is_compliant else "flagged",
                compliance_flags=violations
            )
            # MULTI-TENANT: Set owner
            content_obj.owner_id = user["user_id"]
            
            doc = content_obj.model_dump()
            await db.generated_content.insert_one(doc)
            
            # Create compliance audit
            await create_compliance_audit(
                content_obj.id,
                "generated_content",
                content_text,
                violations,
                user.get("user_id", "")
            )
            
            generated_contents.append(content_obj.model_dump())
    
    await log_activity("content_generated", "property", request.property_id, 
                      {"platforms": request.platforms, "languages": request.languages}, user.get("user_id", ""))
    
    return {"contents": generated_contents, "count": len(generated_contents)}

@api_router.get("/content/{property_id}")
async def get_property_content(property_id: str, platform: Optional[str] = None, language: Optional[str] = None, user: dict = Depends(require_auth)):
    """Get generated content for a property - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    query = {"property_id": property_id, "owner_id": user["user_id"]}
    if platform:
        query["platform"] = platform
    if language:
        query["language"] = language
    
    contents = await db.generated_content.find(query, {"_id": 0}).to_list(1000)
    return contents

@api_router.put("/content/{content_id}/approve")
async def approve_content(content_id: str, approval: ContentApproval, user: dict = Depends(require_auth)):
    """Approve or reject content - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    content = await db.generated_content.find_one({"id": content_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Check compliance status before approval
    if approval.approved and content.get("compliance_status") == "flagged":
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot approve flagged content. Issues: {', '.join(content.get('compliance_flags', []))}"
        )
    
    result = await db.generated_content.update_one(
        {"id": content_id, "owner_id": user["user_id"]},
        {"$set": {"approved": approval.approved}}
    )
    
    await log_activity("content_approved" if approval.approved else "content_rejected", 
                      "content", content_id, {}, user.get("user_id", ""))
    return {"message": "Content status updated", "approved": approval.approved}

# ==================== WHATSAPP MESSAGE ENDPOINTS ====================

@api_router.post("/whatsapp/generate")
async def generate_whatsapp(lead_id: str, message_type: str, language: str = "English", user: dict = Depends(require_auth)):
    """Generate a WhatsApp message for a lead - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    lead = await db.leads.find_one({"id": lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    message_text = await generate_whatsapp_message(lead, message_type, language)
    
    whatsapp_msg = WhatsAppMessage(
        lead_id=lead_id,
        lead_phone=lead.get("phone", ""),
        message=message_text,
        language=language,
        message_type=message_type
    )
    # MULTI-TENANT: Set owner
    whatsapp_msg.owner_id = user["user_id"]
    
    doc = whatsapp_msg.model_dump()
    await db.whatsapp_messages.insert_one(doc)
    
    # Create compliance audit
    _, violations = validate_rera_compliance(message_text)
    await create_compliance_audit(whatsapp_msg.id, "whatsapp", message_text, violations, user.get("user_id", ""))
    
    return whatsapp_msg.model_dump()

@api_router.put("/whatsapp/{message_id}/approve")
async def approve_whatsapp(message_id: str, user: dict = Depends(require_auth)):
    """Approve a WhatsApp message - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    result = await db.whatsapp_messages.update_one(
        {"id": message_id, "owner_id": user["user_id"]},
        {"$set": {"status": "approved"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await log_activity("whatsapp_approved", "whatsapp", message_id, {}, user.get("user_id", ""))
    return {"message": "Message approved and ready to send", "status": "approved"}

@api_router.put("/whatsapp/{message_id}/send")
async def send_whatsapp(message_id: str, user: dict = Depends(require_auth)):
    """Send WhatsApp message via Twilio API - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    msg = await db.whatsapp_messages.find_one({"id": message_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if msg.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Message must be approved before sending")
    
    # Send via Twilio
    result = await send_twilio_whatsapp(msg.get("lead_phone", ""), msg.get("message", ""))
    
    new_status = "sent" if result["status"] in ["sent", "simulated"] else "failed"
    
    await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": {
            "status": new_status,
            "twilio_sid": result.get("sid", "")
        }}
    )
    
    await log_activity("whatsapp_sent", "whatsapp", message_id, result, user.get("user_id", ""))
    return {"message": result["message"], "status": new_status, "twilio_sid": result.get("sid", "")}

@api_router.get("/whatsapp/{lead_id}")
async def get_lead_messages(lead_id: str, user: dict = Depends(require_auth)):
    """Get all WhatsApp messages for a lead - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    messages = await db.whatsapp_messages.find({"lead_id": lead_id, "owner_id": user["user_id"]}, {"_id": 0}).to_list(100)
    return messages

# ==================== EMAIL MESSAGE ENDPOINTS ====================

@api_router.post("/email/generate")
async def generate_email(lead_id: str, subject: str, message_type: str, language: str = "English", user: dict = Depends(require_auth)):
    """Generate an email message for a lead - MULTI-TENANT"""
    # MULTI-TENANT: Filter by owner_id
    lead = await db.leads.find_one({"id": lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Generate email body using AI
    body = await generate_whatsapp_message(lead, message_type, language)  # Reuse message generation
    body = body.replace("[AGENT_NAME]", "Your PropBoost Agent")
    
    email_msg = EmailMessage(
        lead_id=lead_id,
        lead_email=lead.get("email", ""),
        subject=subject,
        body=body,
        language=language,
        message_type=message_type
    )
    # MULTI-TENANT: Set owner
    email_msg.owner_id = user["user_id"]
    
    doc = email_msg.model_dump()
    await db.email_messages.insert_one(doc)
    
    return email_msg.model_dump()

@api_router.put("/email/{message_id}/approve")
async def approve_email(message_id: str, user: dict = Depends(require_auth)):
    """Approve an email message"""
    result = await db.email_messages.update_one(
        {"id": message_id},
        {"$set": {"status": "approved"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Email not found")
    
    await log_activity("email_approved", "email", message_id, {}, user.get("user_id", ""))
    return {"message": "Email approved and ready to send", "status": "approved"}

@api_router.put("/email/{message_id}/send")
async def send_email_message(message_id: str, user: dict = Depends(require_auth)):
    """Send email via SendGrid API"""
    msg = await db.email_messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if msg.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Email must be approved before sending")
    
    # Send via SendGrid
    result = await send_sendgrid_email(msg.get("lead_email", ""), msg.get("subject", ""), msg.get("body", ""))
    
    new_status = "sent" if result["status"] in ["sent", "simulated"] else "failed"
    
    await db.email_messages.update_one(
        {"id": message_id},
        {"$set": {
            "status": new_status,
            "sendgrid_id": result.get("message_id", "")
        }}
    )
    
    await log_activity("email_sent", "email", message_id, result, user.get("user_id", ""))
    return {"message": result["message"], "status": new_status}

# ==================== PIPELINE ENDPOINTS ====================

@api_router.put("/pipeline/{lead_id}/stage")
async def update_pipeline_stage(lead_id: str, stage: str, probability: Optional[int] = None, user: dict = Depends(require_auth)):
    """Update lead's pipeline stage"""
    valid_stages = ["new", "qualified", "viewing", "negotiation", "closing", "won", "lost"]
    if stage not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {valid_stages}")
    
    update_data = {"stage": stage, "updated_at": datetime.now(timezone.utc).isoformat()}
    if probability is not None:
        update_data["probability"] = probability
    
    result = await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    await log_activity("pipeline_updated", "lead", lead_id, {"stage": stage}, user.get("user_id", ""))
    return lead

@api_router.get("/pipeline/stats")
async def get_pipeline_stats(user: dict = Depends(require_auth)):
    """Get pipeline statistics"""
    stages = ["new", "qualified", "viewing", "negotiation", "closing", "won", "lost"]
    stats = {}
    
    for stage in stages:
        count = await db.leads.count_documents({"stage": stage})
        pipeline = [
            {"$match": {"stage": stage}},
            {"$group": {"_id": None, "total_probability": {"$avg": "$probability"}}}
        ]
        prob_result = await db.leads.aggregate(pipeline).to_list(1)
        avg_prob = prob_result[0]["total_probability"] if prob_result else 0
        
        stats[stage] = {"count": count, "avg_probability": round(avg_prob, 1) if avg_prob else 0}
    
    total_leads = await db.leads.count_documents({})
    hot_leads = await db.leads.count_documents({"score": {"$gte": 8}})
    warm_leads = await db.leads.count_documents({"score": {"$gte": 6, "$lt": 8}})
    cold_leads = await db.leads.count_documents({"score": {"$lt": 6}})
    
    return {
        "stages": stats,
        "totals": {
            "total": total_leads,
            "hot": hot_leads,
            "warm": warm_leads,
            "cold": cold_leads
        }
    }

# ==================== ANALYTICS/LEADERBOARD ENDPOINTS ====================

@api_router.get("/analytics/leaderboard")
async def get_lead_source_leaderboard(user: dict = Depends(require_auth)):
    """Get lead source leaderboard with conversion rates and projected revenue"""
    
    lead_sources = ["Property Finder", "Bayut", "Instagram", "WhatsApp", "Walk-in"]
    leaderboard = []
    
    for source in lead_sources:
        # Total leads from this source
        total_leads = await db.leads.count_documents({"lead_source": source})
        
        # Leads that converted (won stage)
        converted_leads = await db.leads.count_documents({
            "lead_source": source,
            "stage": "won"
        })
        
        # Calculate conversion rate
        conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0
        
        # Calculate total projected revenue
        pipeline = [
            {"$match": {"lead_source": source}},
            {"$group": {
                "_id": None,
                "total_revenue": {"$sum": "$estimated_deal_value"},
                "avg_deal_value": {"$avg": "$estimated_deal_value"}
            }}
        ]
        revenue_result = await db.leads.aggregate(pipeline).to_list(1)
        
        total_revenue = revenue_result[0]["total_revenue"] if revenue_result else 0
        avg_deal_value = revenue_result[0]["avg_deal_value"] if revenue_result else 0
        
        # Hot leads from this source
        hot_leads = await db.leads.count_documents({
            "lead_source": source,
            "score": {"$gte": 8}
        })
        
        leaderboard.append({
            "source": source,
            "total_leads": total_leads,
            "converted_leads": converted_leads,
            "conversion_rate": round(conversion_rate, 1),
            "total_projected_revenue": total_revenue,
            "avg_deal_value": round(avg_deal_value, 0) if avg_deal_value else 0,
            "hot_leads": hot_leads
        })
    
    # Sort by conversion rate (descending)
    leaderboard.sort(key=lambda x: x["conversion_rate"], reverse=True)
    
    # Add ranking
    for i, item in enumerate(leaderboard):
        item["rank"] = i + 1
    
    return {
        "leaderboard": leaderboard,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/analytics/score-distribution")
async def get_score_distribution(user: dict = Depends(require_auth)):
    """Get lead score distribution"""
    distribution = []
    for score in range(1, 11):
        count = await db.leads.count_documents({"score": score})
        distribution.append({"score": score, "count": count})
    return distribution

@api_router.get("/analytics/source-performance")
async def get_source_performance(user: dict = Depends(require_auth)):
    """Get detailed source performance metrics"""
    pipeline = [
        {"$group": {
            "_id": "$lead_source",
            "total_leads": {"$sum": 1},
            "avg_score": {"$avg": "$score"},
            "total_value": {"$sum": "$estimated_deal_value"},
            "stages": {"$push": "$stage"}
        }}
    ]
    
    results = await db.leads.aggregate(pipeline).to_list(100)
    
    performance = []
    for result in results:
        stages = result.get("stages", [])
        won_count = stages.count("won") if stages else 0
        
        performance.append({
            "source": result["_id"] or "Unknown",
            "total_leads": result["total_leads"],
            "avg_score": round(result["avg_score"], 1) if result["avg_score"] else 0,
            "total_value": result["total_value"] or 0,
            "conversion_rate": round(won_count / result["total_leads"] * 100, 1) if result["total_leads"] > 0 else 0
        })
    
    return performance

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(require_auth)):
    """Get dashboard overview statistics - MULTI-TENANT: Only user's own data"""
    # MULTI-TENANT: Filter by owner_id
    user_filter = {"owner_id": user["user_id"]}
    
    total_leads = await db.leads.count_documents(user_filter)
    hot_leads = await db.leads.count_documents({**user_filter, "score": {"$gte": 8}})
    warm_leads = await db.leads.count_documents({**user_filter, "score": {"$gte": 6, "$lt": 8}})
    cold_leads = await db.leads.count_documents({**user_filter, "score": {"$lt": 6}})
    
    total_properties = await db.properties.count_documents(user_filter)
    total_content = await db.generated_content.count_documents(user_filter)
    approved_content = await db.generated_content.count_documents({**user_filter, "approved": True})
    
    # Pipeline counts
    pipeline_counts = {}
    for stage in ["new", "qualified", "viewing", "negotiation", "closing", "won", "lost"]:
        pipeline_counts[stage] = await db.leads.count_documents({**user_filter, "stage": stage})
    
    # Score distribution
    score_distribution = []
    for i in range(1, 11):
        count = await db.leads.count_documents({**user_filter, "score": i})
        score_distribution.append({"score": i, "count": count})
    
    # Lead source distribution
    source_distribution = []
    for source in ["Property Finder", "Bayut", "Instagram", "WhatsApp", "Walk-in"]:
        count = await db.leads.count_documents({**user_filter, "lead_source": source})
        source_distribution.append({"source": source, "count": count})
    
    return {
        "leads": {
            "total": total_leads,
            "hot": hot_leads,
            "warm": warm_leads,
            "cold": cold_leads
        },
        "properties": {
            "total": total_properties
        },
        "content": {
            "total": total_content,
            "approved": approved_content,
            "pending": total_content - approved_content
        },
        "pipeline": pipeline_counts,
        "score_distribution": score_distribution,
        "source_distribution": source_distribution
    }

# ==================== ACTIVITY LOG ====================

@api_router.get("/activity-logs")
async def get_activity_logs(limit: int = 50, user: dict = Depends(require_auth)):
    """Get recent activity logs - MULTI-TENANT"""
    # MULTI-TENANT: Filter by user_id
    logs = await db.activity_logs.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

@api_router.get("/compliance-audits")
async def get_compliance_audits(limit: int = 50, user: dict = Depends(require_auth)):
    """Get compliance audit records - MULTI-TENANT"""
    # MULTI-TENANT: Filter by reviewed_by (user_id)
    audits = await db.compliance_audits.find({"reviewed_by": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return audits

# ==================== OMNICHANNEL OUTREACH ENDPOINTS ====================

async def execute_outreach_step(sequence_id: str, step: str):
    """Execute a single outreach step in the sequence"""
    sequence = await db.outreach_sequences.find_one({"id": sequence_id}, {"_id": 0})
    if not sequence or sequence["status"] != "active":
        return
    
    lead = await db.leads.find_one({"id": sequence["lead_id"]}, {"_id": 0})
    if not lead:
        return
    
    logging.info(f"Executing outreach step '{step}' for sequence {sequence_id}")
    
    if step == "voice":
        # Trigger Maya call
        result = await trigger_maya_call(lead, lead.get("language_preference", "English"))
        await db.outreach_sequences.update_one(
            {"id": sequence_id},
            {"$set": {
                "voice_status": result["status"],
                "voice_call_id": result.get("call_id", ""),
                "current_step": "whatsapp" if result["status"] in ["initiated", "simulated"] else "voice"
            }}
        )
        
    elif step == "whatsapp":
        # Send WhatsApp/SMS (using SMS since WhatsApp needs business number)
        message = f"Hi {lead['name']}, this is Maya from PropBoost AI. We tried reaching you regarding your property inquiry. Please call us back or reply to this message. [AI-Assisted]"
        result = await send_twilio_sms(lead["phone"], message)
        await db.outreach_sequences.update_one(
            {"id": sequence_id},
            {"$set": {
                "whatsapp_status": result["status"],
                "whatsapp_sid": result.get("sid", ""),
                "current_step": "sms"
            }}
        )
        
    elif step == "sms":
        # Send SMS follow-up
        message = f"PropBoost AI: Hi {lead['name']}, we're still trying to reach you about your Dubai property inquiry. Call us or reply YES for callback. [AI]"
        result = await send_twilio_sms(lead["phone"], message)
        await db.outreach_sequences.update_one(
            {"id": sequence_id},
            {"$set": {
                "sms_status": result["status"],
                "sms_sid": result.get("sid", ""),
                "current_step": "email"
            }}
        )
        
    elif step == "email":
        # Send email follow-up
        subject = f"PropBoost AI: Following up on your Dubai property inquiry"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color: #0F172A;">Hello {lead['name']},</h2>
            <p>We've been trying to reach you regarding your interest in Dubai real estate.</p>
            <p>Our AI assistant Maya attempted to call you to discuss your property requirements and help you find your perfect property in Dubai.</p>
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>Reply to this email with your preferred callback time</li>
                <li>Call us directly</li>
                <li>Visit our portal to browse properties</li>
            </ul>
            <p>Best regards,<br>PropBoost AI Team</p>
            <p style="font-size: 12px; color: #666;">[AI-Generated Content]</p>
        </body>
        </html>
        """
        result = await send_simulated_email(lead["email"], subject, body, lead["name"])
        await db.outreach_sequences.update_one(
            {"id": sequence_id},
            {"$set": {
                "email_status": result["status"],
                "email_id": result.get("message_id", ""),
                "current_step": "completed",
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    await log_activity("outreach_step_executed", "sequence", sequence_id, {"step": step})

@api_router.post("/outreach/sequences")
async def create_outreach_sequence(data: OutreachSequenceCreate, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)):
    """Create and start an omnichannel outreach sequence"""
    # Verify lead exists and belongs to user
    lead = await db.leads.find_one({"id": data.lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check if active sequence already exists for this lead
    existing = await db.outreach_sequences.find_one({
        "lead_id": data.lead_id,
        "status": "active"
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Active sequence already exists for this lead")
    
    # Create sequence
    sequence = OutreachSequence(
        lead_id=data.lead_id,
        owner_id=user["user_id"],
        voice_at=data.voice_at,
        whatsapp_at=data.whatsapp_at,
        sms_at=data.sms_at,
        email_at=data.email_at
    )
    
    # Calculate next action time
    next_action = datetime.now(timezone.utc) + timedelta(minutes=data.voice_at)
    sequence.next_action_at = next_action.isoformat()
    
    await db.outreach_sequences.insert_one(sequence.model_dump())
    
    # Start first step (voice) immediately if voice_at is 0
    if data.voice_at == 0:
        background_tasks.add_task(execute_outreach_step, sequence.id, "voice")
    
    await log_activity("outreach_sequence_created", "sequence", sequence.id, {
        "lead_id": data.lead_id
    }, user["user_id"])
    
    return sequence.model_dump()

@api_router.get("/outreach/sequences")
async def get_outreach_sequences(status: Optional[str] = None, user: dict = Depends(require_auth)):
    """Get all outreach sequences"""
    query = {"owner_id": user["user_id"]}
    if status:
        query["status"] = status
    
    sequences = await db.outreach_sequences.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with lead data
    for seq in sequences:
        lead = await db.leads.find_one({"id": seq["lead_id"]}, {"_id": 0, "name": 1, "phone": 1, "email": 1})
        if lead:
            seq["lead_name"] = lead.get("name", "Unknown")
            seq["lead_phone"] = lead.get("phone", "")
            seq["lead_email"] = lead.get("email", "")
    
    return sequences

@api_router.get("/outreach/sequences/{sequence_id}")
async def get_outreach_sequence(sequence_id: str, user: dict = Depends(require_auth)):
    """Get a single outreach sequence"""
    sequence = await db.outreach_sequences.find_one({"id": sequence_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return sequence

@api_router.post("/outreach/sequences/{sequence_id}/execute-step")
async def execute_next_step(sequence_id: str, step: str, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)):
    """Manually execute next step in sequence"""
    sequence = await db.outreach_sequences.find_one({"id": sequence_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    
    if sequence["status"] != "active":
        raise HTTPException(status_code=400, detail="Sequence is not active")
    
    valid_steps = ["voice", "whatsapp", "sms", "email"]
    if step not in valid_steps:
        raise HTTPException(status_code=400, detail=f"Invalid step. Must be one of: {valid_steps}")
    
    background_tasks.add_task(execute_outreach_step, sequence_id, step)
    
    return {"message": f"Executing step: {step}", "sequence_id": sequence_id}

@api_router.put("/outreach/sequences/{sequence_id}/pause")
async def pause_sequence(sequence_id: str, user: dict = Depends(require_auth)):
    """Pause an active sequence"""
    result = await db.outreach_sequences.update_one(
        {"id": sequence_id, "owner_id": user["user_id"], "status": "active"},
        {"$set": {"status": "paused"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active sequence not found")
    return {"message": "Sequence paused"}

@api_router.put("/outreach/sequences/{sequence_id}/resume")
async def resume_sequence(sequence_id: str, user: dict = Depends(require_auth)):
    """Resume a paused sequence"""
    result = await db.outreach_sequences.update_one(
        {"id": sequence_id, "owner_id": user["user_id"], "status": "paused"},
        {"$set": {"status": "active"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paused sequence not found")
    return {"message": "Sequence resumed"}

@api_router.put("/outreach/sequences/{sequence_id}/cancel")
async def cancel_sequence(sequence_id: str, user: dict = Depends(require_auth)):
    """Cancel a sequence"""
    result = await db.outreach_sequences.update_one(
        {"id": sequence_id, "owner_id": user["user_id"]},
        {"$set": {"status": "cancelled", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return {"message": "Sequence cancelled"}

@api_router.get("/outreach/stats")
async def get_outreach_stats(user: dict = Depends(require_auth)):
    """Get omnichannel outreach statistics"""
    user_filter = {"owner_id": user["user_id"]}
    
    total_sequences = await db.outreach_sequences.count_documents(user_filter)
    active_sequences = await db.outreach_sequences.count_documents({**user_filter, "status": "active"})
    completed_sequences = await db.outreach_sequences.count_documents({**user_filter, "status": "completed"})
    
    # Channel success rates
    voice_success = await db.outreach_sequences.count_documents({**user_filter, "voice_status": {"$in": ["completed", "initiated", "simulated"]}})
    sms_success = await db.outreach_sequences.count_documents({**user_filter, "sms_status": {"$in": ["sent", "simulated"]}})
    email_success = await db.outreach_sequences.count_documents({**user_filter, "email_status": {"$in": ["sent", "simulated"]}})
    
    return {
        "total_sequences": total_sequences,
        "active_sequences": active_sequences,
        "completed_sequences": completed_sequences,
        "paused_sequences": await db.outreach_sequences.count_documents({**user_filter, "status": "paused"}),
        "channel_stats": {
            "voice": {"total": total_sequences, "success": voice_success},
            "sms": {"total": total_sequences, "success": sms_success},
            "email": {"total": total_sequences, "success": email_success}
        }
    }

# ==================== FOLLOW-UP CADENCE ENDPOINTS ====================

async def execute_followup_action(cadence_id: str, day: int):
    """Execute a follow-up action for a specific day"""
    cadence = await db.followup_cadences.find_one({"id": cadence_id}, {"_id": 0})
    if not cadence or cadence["status"] != "active":
        return
    
    lead = await db.leads.find_one({"id": cadence["lead_id"]}, {"_id": 0})
    if not lead:
        return
    
    logging.info(f"Executing follow-up day {day} for cadence {cadence_id}")
    
    action_key = f"day_{day}_action"
    action = cadence.get(action_key, "voice")
    result_text = ""
    
    if action == "voice":
        result = await trigger_maya_call(lead, lead.get("language_preference", "English"))
        result_text = f"Voice call {result['status']}"
    elif action == "whatsapp":
        message = f"Hi {lead['name']}, following up on your Dubai property inquiry. Are you still interested? Reply YES or call us. - PropBoost AI [AI]"
        result = await send_twilio_sms(lead["phone"], message)
        result_text = f"WhatsApp/SMS {result['status']}"
    elif action == "email":
        subject = "Final Follow-up: Your Dubai Property Inquiry"
        body = f"""
        <html><body>
        <h2>Hello {lead['name']},</h2>
        <p>This is our final follow-up regarding your Dubai property inquiry.</p>
        <p>If you're no longer interested, no worries! But if you'd like to continue the conversation, simply reply to this email.</p>
        <p>Best regards,<br>PropBoost AI</p>
        <p style="font-size:12px;color:#666;">[AI-Generated Content]</p>
        </body></html>
        """
        result = await send_simulated_email(lead["email"], subject, body, lead["name"])
        result_text = f"Email {result['status']}"
    
    # Update cadence
    update_data = {
        f"day_{day}_completed": True,
        f"day_{day}_result": result_text
    }
    
    # Calculate next action
    next_days = {1: 2, 2: 4, 4: 7}
    if day in next_days:
        next_day = next_days[day]
        next_action = datetime.now(timezone.utc) + timedelta(days=next_day - day)
        update_data["next_action_at"] = next_action.isoformat()
        update_data["next_action_day"] = next_day
    elif day == 7:
        update_data["status"] = "completed"
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.followup_cadences.update_one({"id": cadence_id}, {"$set": update_data})
    await log_activity("followup_executed", "cadence", cadence_id, {"day": day, "action": action})

@api_router.post("/followups/cadences")
async def create_followup_cadence(lead_id: str, trigger_reason: str = "missed_call", background_tasks: BackgroundTasks = None, user: dict = Depends(require_auth)):
    """Create an automated follow-up cadence for a lead"""
    # Verify lead exists
    lead = await db.leads.find_one({"id": lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check for existing active cadence
    existing = await db.followup_cadences.find_one({"lead_id": lead_id, "status": "active"}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Active cadence already exists for this lead")
    
    # Create cadence
    cadence = FollowUpCadence(
        lead_id=lead_id,
        owner_id=user["user_id"],
        trigger_reason=trigger_reason
    )
    
    # Set next action (Day 2 since Day 1 is the missed call that triggered this)
    cadence.day_1_completed = True
    cadence.day_1_result = trigger_reason
    next_action = datetime.now(timezone.utc) + timedelta(days=1)
    cadence.next_action_at = next_action.isoformat()
    cadence.next_action_day = 2
    
    await db.followup_cadences.insert_one(cadence.model_dump())
    
    await log_activity("followup_cadence_created", "cadence", cadence.id, {
        "lead_id": lead_id,
        "trigger": trigger_reason
    }, user["user_id"])
    
    return cadence.model_dump()

@api_router.get("/followups/cadences")
async def get_followup_cadences(status: Optional[str] = None, user: dict = Depends(require_auth)):
    """Get all follow-up cadences"""
    query = {"owner_id": user["user_id"]}
    if status:
        query["status"] = status
    
    cadences = await db.followup_cadences.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with lead data
    for cad in cadences:
        lead = await db.leads.find_one({"id": cad["lead_id"]}, {"_id": 0, "name": 1, "phone": 1, "score": 1})
        if lead:
            cad["lead_name"] = lead.get("name", "Unknown")
            cad["lead_phone"] = lead.get("phone", "")
            cad["lead_score"] = lead.get("score", 0)
    
    return cadences

@api_router.get("/followups/cadences/{cadence_id}")
async def get_followup_cadence(cadence_id: str, user: dict = Depends(require_auth)):
    """Get a single follow-up cadence"""
    cadence = await db.followup_cadences.find_one({"id": cadence_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not cadence:
        raise HTTPException(status_code=404, detail="Cadence not found")
    return cadence

@api_router.post("/followups/cadences/{cadence_id}/execute-day")
async def execute_followup_day(cadence_id: str, day: int, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)):
    """Manually execute a follow-up day"""
    cadence = await db.followup_cadences.find_one({"id": cadence_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not cadence:
        raise HTTPException(status_code=404, detail="Cadence not found")
    
    if day not in [1, 2, 4, 7]:
        raise HTTPException(status_code=400, detail="Day must be 1, 2, 4, or 7")
    
    background_tasks.add_task(execute_followup_action, cadence_id, day)
    return {"message": f"Executing follow-up day {day}"}

@api_router.put("/followups/cadences/{cadence_id}/mark-responded")
async def mark_lead_responded(cadence_id: str, user: dict = Depends(require_auth)):
    """Mark cadence as responded (lead replied)"""
    result = await db.followup_cadences.update_one(
        {"id": cadence_id, "owner_id": user["user_id"]},
        {"$set": {
            "status": "responded",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cadence not found")
    return {"message": "Cadence marked as responded"}

@api_router.put("/followups/cadences/{cadence_id}/cancel")
async def cancel_followup_cadence(cadence_id: str, user: dict = Depends(require_auth)):
    """Cancel a follow-up cadence"""
    result = await db.followup_cadences.update_one(
        {"id": cadence_id, "owner_id": user["user_id"]},
        {"$set": {"status": "cancelled", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cadence not found")
    return {"message": "Cadence cancelled"}

@api_router.get("/followups/stats")
async def get_followup_stats(user: dict = Depends(require_auth)):
    """Get follow-up cadence statistics"""
    user_filter = {"owner_id": user["user_id"]}
    
    total_cadences = await db.followup_cadences.count_documents(user_filter)
    active_cadences = await db.followup_cadences.count_documents({**user_filter, "status": "active"})
    completed_cadences = await db.followup_cadences.count_documents({**user_filter, "status": "completed"})
    responded_cadences = await db.followup_cadences.count_documents({**user_filter, "status": "responded"})
    
    # Response rate
    response_rate = round((responded_cadences / total_cadences * 100) if total_cadences > 0 else 0, 1)
    
    # Trigger reasons breakdown
    missed_call_count = await db.followup_cadences.count_documents({**user_filter, "trigger_reason": "missed_call"})
    no_response_count = await db.followup_cadences.count_documents({**user_filter, "trigger_reason": "no_response"})
    callback_count = await db.followup_cadences.count_documents({**user_filter, "trigger_reason": "callback_requested"})
    
    return {
        "total_cadences": total_cadences,
        "active_cadences": active_cadences,
        "completed_cadences": completed_cadences,
        "responded_cadences": responded_cadences,
        "response_rate": response_rate,
        "trigger_breakdown": {
            "missed_call": missed_call_count,
            "no_response": no_response_count,
            "callback_requested": callback_count
        }
    }

# ==================== LEARNING ENGINE ENDPOINTS ====================

@api_router.post("/learning/conversations")
async def log_conversation(
    lead_id: str,
    call_id: str = "",
    transcript: str = "",
    summary: str = "",
    duration_seconds: float = 0,
    outcome: str = "",
    user: dict = Depends(require_auth)
):
    """Log a Maya conversation for learning analysis"""
    lead = await db.leads.find_one({"id": lead_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Extract BANT from transcript if available
    bant_data = {}
    if transcript or summary:
        bant_data = await extract_bant_from_call(transcript, summary)
    
    log = ConversationLog(
        lead_id=lead_id,
        owner_id=user["user_id"],
        call_id=call_id,
        transcript=transcript,
        summary=summary,
        duration_seconds=duration_seconds,
        language=lead.get("language_preference", "English"),
        bant_budget=bant_data.get("budget", ""),
        bant_authority=bant_data.get("authority", ""),
        bant_need=bant_data.get("need", ""),
        bant_timeline=bant_data.get("timeline", ""),
        outcome=outcome,
        ai_confidence=calculate_confidence_score(bant_data, outcome, duration_seconds),
        objections_raised=bant_data.get("objections", "").split(",") if bant_data.get("objections") else []
    )
    
    await db.conversation_logs.insert_one(log.model_dump())
    await log_activity("conversation_logged", "learning", log.id, {"lead_id": lead_id}, user["user_id"])
    
    return log.model_dump()

@api_router.get("/learning/conversations")
async def get_conversations(limit: int = 50, outcome: Optional[str] = None, user: dict = Depends(require_auth)):
    """Get conversation logs for learning analysis"""
    query = {"owner_id": user["user_id"]}
    if outcome:
        query["outcome"] = outcome
    
    logs = await db.conversation_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    # Enrich with lead data
    for log in logs:
        lead = await db.leads.find_one({"id": log["lead_id"]}, {"_id": 0, "name": 1})
        if lead:
            log["lead_name"] = lead.get("name", "Unknown")
    
    return logs

@api_router.post("/learning/conversations/{conversation_id}/rate")
async def rate_conversation(conversation_id: str, rating: BrokerRating, user: dict = Depends(require_auth)):
    """Broker rates a Maya conversation for learning"""
    log = await db.conversation_logs.find_one({"id": conversation_id, "owner_id": user["user_id"]}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if rating.rating < 1 or rating.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    update_data = {
        "broker_rating": rating.rating,
        "broker_feedback": rating.feedback,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if rating.deal_status:
        update_data["deal_status"] = rating.deal_status
    if rating.deal_value > 0:
        update_data["deal_value"] = rating.deal_value
        if rating.deal_status == "won":
            update_data["deal_closed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.conversation_logs.update_one({"id": conversation_id}, {"$set": update_data})
    await log_activity("conversation_rated", "learning", conversation_id, {"rating": rating.rating}, user["user_id"])
    
    return {"message": "Conversation rated successfully"}

@api_router.get("/learning/patterns")
async def get_learning_patterns(user: dict = Depends(require_auth)):
    """Analyze conversation patterns for Maya's learning"""
    user_filter = {"owner_id": user["user_id"]}
    
    conversations = await db.conversation_logs.find(user_filter, {"_id": 0}).to_list(1000)
    
    if not conversations:
        return {
            "total_conversations": 0,
            "patterns": [],
            "insights": []
        }
    
    # Aggregate patterns
    total = len(conversations)
    qualified_count = len([c for c in conversations if c.get("outcome") == "qualified"])
    avg_confidence = sum(c.get("ai_confidence", 0) for c in conversations) / total if total > 0 else 0
    avg_duration = sum(c.get("duration_seconds", 0) for c in conversations) / total if total > 0 else 0
    
    # Rating analysis
    rated = [c for c in conversations if c.get("broker_rating", 0) > 0]
    avg_rating = sum(c.get("broker_rating", 0) for c in rated) / len(rated) if rated else 0
    
    # Deal analysis
    won_deals = [c for c in conversations if c.get("deal_status") == "won"]
    lost_deals = [c for c in conversations if c.get("deal_status") == "lost"]
    total_deal_value = sum(c.get("deal_value", 0) for c in won_deals)
    
    # Budget patterns
    budgets = [c.get("bant_budget", "") for c in conversations if c.get("bant_budget")]
    
    # Timeline patterns
    timelines = [c.get("bant_timeline", "") for c in conversations if c.get("bant_timeline")]
    
    # Generate insights
    insights = []
    if avg_confidence > 70:
        insights.append({"type": "positive", "message": f"Maya's average confidence is strong at {avg_confidence:.1f}%"})
    elif avg_confidence < 50:
        insights.append({"type": "warning", "message": f"Maya's confidence is low ({avg_confidence:.1f}%). More training data needed."})
    
    if qualified_count / total > 0.5 if total > 0 else False:
        insights.append({"type": "positive", "message": f"High qualification rate: {qualified_count/total*100:.1f}%"})
    
    if avg_rating >= 4:
        insights.append({"type": "positive", "message": f"Broker satisfaction is excellent (avg {avg_rating:.1f}/5)"})
    elif avg_rating > 0 and avg_rating < 3:
        insights.append({"type": "warning", "message": f"Broker satisfaction needs improvement (avg {avg_rating:.1f}/5)"})
    
    if won_deals:
        insights.append({"type": "success", "message": f"Total revenue from Maya calls: AED {total_deal_value:,.0f}"})
    
    return {
        "total_conversations": total,
        "qualified_count": qualified_count,
        "qualification_rate": round(qualified_count / total * 100, 1) if total > 0 else 0,
        "avg_confidence": round(avg_confidence, 1),
        "avg_duration_seconds": round(avg_duration, 1),
        "avg_broker_rating": round(avg_rating, 1),
        "rated_conversations": len(rated),
        "deals": {
            "won": len(won_deals),
            "lost": len(lost_deals),
            "total_value": total_deal_value
        },
        "patterns": {
            "common_budgets": budgets[:10],
            "common_timelines": timelines[:10]
        },
        "insights": insights
    }

@api_router.get("/learning/stats")
async def get_learning_stats(user: dict = Depends(require_auth)):
    """Get learning engine statistics for dashboard"""
    user_filter = {"owner_id": user["user_id"]}
    
    total_conversations = await db.conversation_logs.count_documents(user_filter)
    rated_conversations = await db.conversation_logs.count_documents({**user_filter, "broker_rating": {"$gt": 0}})
    qualified_conversations = await db.conversation_logs.count_documents({**user_filter, "outcome": "qualified"})
    
    # Get average metrics
    pipeline = [
        {"$match": user_filter},
        {"$group": {
            "_id": None,
            "avg_confidence": {"$avg": "$ai_confidence"},
            "avg_duration": {"$avg": "$duration_seconds"},
            "avg_rating": {"$avg": {"$cond": [{"$gt": ["$broker_rating", 0]}, "$broker_rating", None]}},
            "total_deal_value": {"$sum": {"$cond": [{"$eq": ["$deal_status", "won"]}, "$deal_value", 0]}}
        }}
    ]
    
    agg_result = await db.conversation_logs.aggregate(pipeline).to_list(1)
    metrics = agg_result[0] if agg_result else {}
    
    return {
        "total_conversations": total_conversations,
        "rated_conversations": rated_conversations,
        "qualified_conversations": qualified_conversations,
        "qualification_rate": round(qualified_conversations / total_conversations * 100, 1) if total_conversations > 0 else 0,
        "avg_confidence": round(metrics.get("avg_confidence", 0) or 0, 1),
        "avg_duration_seconds": round(metrics.get("avg_duration", 0) or 0, 1),
        "avg_broker_rating": round(metrics.get("avg_rating", 0) or 0, 1),
        "total_deal_value": metrics.get("total_deal_value", 0) or 0
    }

# Include routers
app.include_router(auth_router)
app.include_router(api_router)

# CORS configuration - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
