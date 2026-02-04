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
    lead_source: str = "Walk-in"  # NEW
    estimated_deal_value: float = 0  # NEW
    maya_call_status: str = ""  # NEW: Voice AI call status
    maya_call_id: str = ""  # NEW: Retell AI call ID
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

# ==================== AUTHENTICATION HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

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
    """Get current user from JWT token or session cookie"""
    # Try Authorization header first
    if credentials and credentials.credentials:
        try:
            payload = decode_jwt_token(credentials.credentials)
            user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
            if user:
                return user
        except:
            pass
    
    # Try session cookie (for Google OAuth)
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
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

# ==================== VOICE AI (RETELL) SERVICE ====================

async def trigger_maya_call(lead: dict, language: str = "English") -> dict:
    """Trigger Maya voice AI call via Retell AI (plug-and-play)"""
    api_key = os.environ.get('RETELL_API_KEY')
    agent_id = os.environ.get('RETELL_AGENT_ID')
    from_number = os.environ.get('RETELL_FROM_NUMBER')
    
    if not all([api_key, agent_id, from_number]):
        return {
            "status": "simulated",
            "call_id": f"SIM_CALL_{uuid.uuid4().hex[:12]}",
            "message": "Retell AI credentials not configured. Call simulated."
        }
    
    # Determine language code
    lang_code = "ar" if language.lower() == "arabic" else "en"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.retellai.com/v2/create-phone-call",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from_number": from_number,
                    "to_number": lead.get("phone", ""),
                    "override_agent_id": agent_id,
                    "retell_llm_dynamic_variables": {
                        "customer_name": lead.get("name", ""),
                        "language": lang_code,
                        "budget_range": lead.get("property_interests", {}).get("budget", ""),
                        "location_preference": lead.get("property_interests", {}).get("location", "")
                    },
                    "metadata": {
                        "lead_id": lead.get("id", ""),
                        "lead_name": lead.get("name", ""),
                        "language": language
                    }
                }
            )
            result = response.json()
            return {
                "status": "initiated",
                "call_id": result.get("call_id", ""),
                "message": "Maya call initiated successfully"
            }
    except Exception as e:
        logging.error(f"Retell AI call error: {e}")
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
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
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
    await db.users.insert_one(user_doc)
    
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
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user_doc["user_id"], user_doc["email"])
    
    await log_activity("user_login", "user", user_doc["user_id"], {"method": "password"})
    
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
            
            # Create session
            session_token = oauth_data.get("session_token", str(uuid.uuid4()))
            expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
            
            session = UserSession(
                user_id=user_id,
                session_token=session_token,
                expires_at=expires_at
            )
            
            # Upsert session
            await db.user_sessions.update_one(
                {"user_id": user_id},
                {"$set": session.model_dump()},
                upsert=True
            )
            
            await log_activity("user_login", "user", user_id, {"method": "google_oauth"})
            
            user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
            
            return {
                "user": user_doc,
                "session_token": session_token,
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
async def create_lead(lead_input: LeadCreate, background_tasks: BackgroundTasks, user: dict = Depends(require_auth)):
    """Create a new lead and score with AI"""
    lead = Lead(**lead_input.model_dump())
    
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
    
    doc = lead.model_dump()
    await db.leads.insert_one(doc)
    
    # Trigger Maya call for hot leads (score > 7)
    if lead.score > 7:
        background_tasks.add_task(
            trigger_maya_call_background,
            lead.model_dump(),
            lead.language_preference
        )
    
    await log_activity("lead_created", "lead", lead.id, {"score": lead.score}, user.get("user_id", ""))
    
    return lead

async def trigger_maya_call_background(lead_data: dict, language: str):
    """Background task to trigger Maya voice AI call"""
    try:
        result = await trigger_maya_call(lead_data, language)
        if result["status"] in ["initiated", "simulated"]:
            await db.leads.update_one(
                {"id": lead_data["id"]},
                {"$set": {
                    "maya_call_status": result["status"],
                    "maya_call_id": result["call_id"]
                }}
            )
            await log_activity("maya_call_triggered", "lead", lead_data["id"], result)
    except Exception as e:
        logging.error(f"Maya call background task error: {e}")

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    stage: Optional[str] = None, 
    score_min: Optional[int] = None, 
    score_max: Optional[int] = None,
    lead_source: Optional[str] = None,
    user: dict = Depends(require_auth)
):
    """Get all leads with optional filters"""
    query = {}
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
    """Get a single lead by ID"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate, user: dict = Depends(require_auth)):
    """Update a lead"""
    update_data = {k: v for k, v in lead_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    await log_activity("lead_updated", "lead", lead_id, update_data, user.get("user_id", ""))
    return lead

@api_router.post("/leads/{lead_id}/rescore", response_model=Lead)
async def rescore_lead(lead_id: str, user: dict = Depends(require_auth)):
    """Rescore an existing lead with AI"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
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
    """Delete a lead"""
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    await log_activity("lead_deleted", "lead", lead_id, {}, user.get("user_id", ""))
    return {"message": "Lead deleted successfully"}

# ==================== VOICE AI ENDPOINTS ====================

@api_router.post("/voice/trigger-call")
async def trigger_voice_call(request: VoiceCallRequest, user: dict = Depends(require_auth)):
    """Manually trigger Maya voice AI call for a lead"""
    lead = await db.leads.find_one({"id": request.lead_id}, {"_id": 0})
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
    """Handle Retell AI webhook events"""
    try:
        body = await request.body()
        payload = await request.json()
        
        event_type = payload.get("event", "")
        call_data = payload.get("call", {})
        lead_id = call_data.get("metadata", {}).get("lead_id", "")
        
        if event_type == "call_ended" and lead_id:
            # Update lead with call results
            transcript = call_data.get("transcript", "")
            analysis = call_data.get("call_analysis", {})
            
            update_data = {
                "maya_call_status": "completed",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Extract qualification data from analysis
            if analysis.get("budget"):
                if "property_interests" not in update_data:
                    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
                    update_data["property_interests"] = lead.get("property_interests", {})
                update_data["property_interests"]["budget"] = analysis.get("budget")
            
            await db.leads.update_one({"id": lead_id}, {"$set": update_data})
            
            # Log call transcript
            await db.voice_call_logs.insert_one({
                "id": str(uuid.uuid4()),
                "lead_id": lead_id,
                "call_id": call_data.get("call_id", ""),
                "transcript": transcript,
                "analysis": analysis,
                "duration": call_data.get("duration", 0),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            await log_activity("maya_call_completed", "lead", lead_id, {
                "call_id": call_data.get("call_id"),
                "duration": call_data.get("duration")
            })
        
        return {"status": "received"}
    except Exception as e:
        logging.error(f"Voice webhook error: {e}")
        return {"status": "error", "message": str(e)}

# ==================== PROPERTY ENDPOINTS ====================

@api_router.post("/properties", response_model=Property)
async def create_property(property_input: PropertyCreate, user: dict = Depends(require_auth)):
    """Create a new property"""
    property_obj = Property(**property_input.model_dump())
    doc = property_obj.model_dump()
    await db.properties.insert_one(doc)
    await log_activity("property_created", "property", property_obj.id, {"title": property_obj.title}, user.get("user_id", ""))
    return property_obj

@api_router.get("/properties", response_model=List[Property])
async def get_properties(user: dict = Depends(require_auth)):
    """Get all properties"""
    properties = await db.properties.find({}, {"_id": 0}).to_list(1000)
    return properties

@api_router.get("/properties/{property_id}", response_model=Property)
async def get_property(property_id: str, user: dict = Depends(require_auth)):
    """Get a single property"""
    property_obj = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
    return property_obj

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, user: dict = Depends(require_auth)):
    """Delete a property"""
    result = await db.properties.delete_one({"id": property_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    return {"message": "Property deleted successfully"}

# ==================== CONTENT GENERATION ENDPOINTS ====================

@api_router.post("/content/generate")
async def generate_content(request: ContentRequest, user: dict = Depends(require_auth)):
    """Generate multilingual content for a property with RERA compliance check"""
    property_obj = await db.properties.find_one({"id": request.property_id}, {"_id": 0})
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
    """Get generated content for a property"""
    query = {"property_id": property_id}
    if platform:
        query["platform"] = platform
    if language:
        query["language"] = language
    
    contents = await db.generated_content.find(query, {"_id": 0}).to_list(1000)
    return contents

@api_router.put("/content/{content_id}/approve")
async def approve_content(content_id: str, approval: ContentApproval, user: dict = Depends(require_auth)):
    """Approve or reject content"""
    content = await db.generated_content.find_one({"id": content_id}, {"_id": 0})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Check compliance status before approval
    if approval.approved and content.get("compliance_status") == "flagged":
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot approve flagged content. Issues: {', '.join(content.get('compliance_flags', []))}"
        )
    
    result = await db.generated_content.update_one(
        {"id": content_id},
        {"$set": {"approved": approval.approved}}
    )
    
    await log_activity("content_approved" if approval.approved else "content_rejected", 
                      "content", content_id, {}, user.get("user_id", ""))
    return {"message": "Content status updated", "approved": approval.approved}

# ==================== WHATSAPP MESSAGE ENDPOINTS ====================

@api_router.post("/whatsapp/generate")
async def generate_whatsapp(lead_id: str, message_type: str, language: str = "English", user: dict = Depends(require_auth)):
    """Generate a WhatsApp message for a lead"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
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
    
    doc = whatsapp_msg.model_dump()
    await db.whatsapp_messages.insert_one(doc)
    
    # Create compliance audit
    _, violations = validate_rera_compliance(message_text)
    await create_compliance_audit(whatsapp_msg.id, "whatsapp", message_text, violations, user.get("user_id", ""))
    
    return whatsapp_msg.model_dump()

@api_router.put("/whatsapp/{message_id}/approve")
async def approve_whatsapp(message_id: str, user: dict = Depends(require_auth)):
    """Approve a WhatsApp message"""
    result = await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": {"status": "approved"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await log_activity("whatsapp_approved", "whatsapp", message_id, {}, user.get("user_id", ""))
    return {"message": "Message approved and ready to send", "status": "approved"}

@api_router.put("/whatsapp/{message_id}/send")
async def send_whatsapp(message_id: str, user: dict = Depends(require_auth)):
    """Send WhatsApp message via Twilio API"""
    msg = await db.whatsapp_messages.find_one({"id": message_id}, {"_id": 0})
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
    """Get all WhatsApp messages for a lead"""
    messages = await db.whatsapp_messages.find({"lead_id": lead_id}, {"_id": 0}).to_list(100)
    return messages

# ==================== EMAIL MESSAGE ENDPOINTS ====================

@api_router.post("/email/generate")
async def generate_email(lead_id: str, subject: str, message_type: str, language: str = "English", user: dict = Depends(require_auth)):
    """Generate an email message for a lead"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
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
    """Get dashboard overview statistics"""
    total_leads = await db.leads.count_documents({})
    hot_leads = await db.leads.count_documents({"score": {"$gte": 8}})
    warm_leads = await db.leads.count_documents({"score": {"$gte": 6, "$lt": 8}})
    cold_leads = await db.leads.count_documents({"score": {"$lt": 6}})
    
    total_properties = await db.properties.count_documents({})
    total_content = await db.generated_content.count_documents({})
    approved_content = await db.generated_content.count_documents({"approved": True})
    
    # Pipeline counts
    pipeline_counts = {}
    for stage in ["new", "qualified", "viewing", "negotiation", "closing", "won", "lost"]:
        pipeline_counts[stage] = await db.leads.count_documents({"stage": stage})
    
    # Score distribution
    score_distribution = []
    for i in range(1, 11):
        count = await db.leads.count_documents({"score": i})
        score_distribution.append({"score": i, "count": count})
    
    # Lead source distribution
    source_distribution = []
    for source in ["Property Finder", "Bayut", "Instagram", "WhatsApp", "Walk-in"]:
        count = await db.leads.count_documents({"lead_source": source})
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
    """Get recent activity logs"""
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

@api_router.get("/compliance-audits")
async def get_compliance_audits(limit: int = 50, user: dict = Depends(require_auth)):
    """Get compliance audit records"""
    audits = await db.compliance_audits.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return audits

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
