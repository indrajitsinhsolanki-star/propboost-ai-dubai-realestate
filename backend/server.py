from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class LeadCreate(BaseModel):
    name: str
    phone: str
    email: str
    language_preference: str = "English"
    property_interests: Dict[str, Any] = {}
    notes: str = ""

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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ContentApproval(BaseModel):
    content_id: str
    approved: bool

class WhatsAppMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    message: str
    language: str
    message_type: str  # reminder, confirmation, follow_up
    status: str = "draft"  # draft, approved, sent
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str
    entity_type: str
    entity_id: str
    details: Dict[str, Any] = {}
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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

Return valid JSON only."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        # Parse JSON from response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        result = json.loads(response_text)
        
        # Ensure ai_briefing is a string, not a list
        if isinstance(result.get('ai_briefing'), list):
            result['ai_briefing'] = '\n• '.join(result['ai_briefing'])
        return result
    except Exception as e:
        logging.error(f"Lead scoring error: {e}")
        return {"score": 5, "reasoning": "Manual review needed", "ai_briefing": "Unable to auto-score. Please review manually.", "category": "warm"}

async def generate_content_with_ai(property_data: dict, platform: str, language: str) -> dict:
    """Generate marketing content for a property in specified language"""
    
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
    
    For Arabic: Use proper Modern Standard Arabic with correct diacritics.
    For all content: Include RERA compliance note "[AI-Generated Content]" at the end.
    Never make false claims about investment returns or guaranteed appreciation.
    
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

Return valid JSON only."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        result = json.loads(response_text)
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
    Return plain text only, no JSON."""
    
    try:
        chat = await get_llm_chat(f"whatsapp-{uuid.uuid4()}", system_message)
        prompt = f"""Generate message for:
Lead Name: {lead_data.get('name', 'Valued Client')}
Language: {language}
Message Type: {message_type}

Return plain text message only."""
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        return response.strip()
    except Exception as e:
        logging.error(f"WhatsApp message error: {e}")
        return f"[Unable to generate message: {str(e)}]"

# ==================== LEAD ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "PropBoost AI API", "version": "1.0.0"}

@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_input: LeadCreate):
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
    
    # Log activity
    await log_activity("lead_created", "lead", lead.id, {"score": lead.score})
    
    return lead

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(stage: Optional[str] = None, score_min: Optional[int] = None, score_max: Optional[int] = None):
    """Get all leads with optional filters"""
    query = {}
    if stage:
        query["stage"] = stage
    if score_min is not None:
        query["score"] = {"$gte": score_min}
    if score_max is not None:
        query.setdefault("score", {})["$lte"] = score_max
    
    leads = await db.leads.find(query, {"_id": 0}).to_list(1000)
    
    # Clean up any leads with ai_briefing as list (legacy data)
    cleaned_leads = []
    for lead in leads:
        if isinstance(lead.get('ai_briefing'), list):
            lead['ai_briefing'] = '\n• '.join(lead['ai_briefing'])
        cleaned_leads.append(lead)
    
    return cleaned_leads

@api_router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str):
    """Get a single lead by ID"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate):
    """Update a lead"""
    update_data = {k: v for k, v in lead_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    await log_activity("lead_updated", "lead", lead_id, update_data)
    return lead

@api_router.post("/leads/{lead_id}/rescore", response_model=Lead)
async def rescore_lead(lead_id: str):
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
    await log_activity("lead_rescored", "lead", lead_id, {"new_score": update_data["score"]})
    return lead

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str):
    """Delete a lead"""
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
    await log_activity("lead_deleted", "lead", lead_id, {})
    return {"message": "Lead deleted successfully"}

# ==================== PROPERTY ENDPOINTS ====================

@api_router.post("/properties", response_model=Property)
async def create_property(property_input: PropertyCreate):
    """Create a new property"""
    property_obj = Property(**property_input.model_dump())
    doc = property_obj.model_dump()
    await db.properties.insert_one(doc)
    await log_activity("property_created", "property", property_obj.id, {"title": property_obj.title})
    return property_obj

@api_router.get("/properties", response_model=List[Property])
async def get_properties():
    """Get all properties"""
    properties = await db.properties.find({}, {"_id": 0}).to_list(1000)
    return properties

@api_router.get("/properties/{property_id}", response_model=Property)
async def get_property(property_id: str):
    """Get a single property"""
    property_obj = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
    return property_obj

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str):
    """Delete a property"""
    result = await db.properties.delete_one({"id": property_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Property not found")
    return {"message": "Property deleted successfully"}

# ==================== CONTENT GENERATION ENDPOINTS ====================

@api_router.post("/content/generate")
async def generate_content(request: ContentRequest):
    """Generate multilingual content for a property"""
    property_obj = await db.properties.find_one({"id": request.property_id}, {"_id": 0})
    if not property_obj:
        raise HTTPException(status_code=404, detail="Property not found")
    
    generated_contents = []
    
    for platform in request.platforms:
        for language in request.languages:
            content_result = await generate_content_with_ai(property_obj, platform, language)
            
            content_obj = GeneratedContent(
                property_id=request.property_id,
                platform=platform,
                language=language,
                content=content_result.get("content", ""),
                hashtags=content_result.get("hashtags", "")
            )
            
            doc = content_obj.model_dump()
            await db.generated_content.insert_one(doc)
            generated_contents.append(content_obj.model_dump())
    
    await log_activity("content_generated", "property", request.property_id, 
                      {"platforms": request.platforms, "languages": request.languages})
    
    return {"contents": generated_contents, "count": len(generated_contents)}

@api_router.get("/content/{property_id}")
async def get_property_content(property_id: str, platform: Optional[str] = None, language: Optional[str] = None):
    """Get generated content for a property"""
    query = {"property_id": property_id}
    if platform:
        query["platform"] = platform
    if language:
        query["language"] = language
    
    contents = await db.generated_content.find(query, {"_id": 0}).to_list(1000)
    return contents

@api_router.put("/content/{content_id}/approve")
async def approve_content(content_id: str, approval: ContentApproval):
    """Approve or reject content"""
    result = await db.generated_content.update_one(
        {"id": content_id},
        {"$set": {"approved": approval.approved}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    
    await log_activity("content_approved" if approval.approved else "content_rejected", 
                      "content", content_id, {})
    return {"message": "Content status updated", "approved": approval.approved}

# ==================== WHATSAPP MESSAGE ENDPOINTS ====================

@api_router.post("/whatsapp/generate")
async def generate_whatsapp(lead_id: str, message_type: str, language: str = "English"):
    """Generate a WhatsApp message for a lead"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    message_text = await generate_whatsapp_message(lead, message_type, language)
    
    whatsapp_msg = WhatsAppMessage(
        lead_id=lead_id,
        message=message_text,
        language=language,
        message_type=message_type
    )
    
    doc = whatsapp_msg.model_dump()
    await db.whatsapp_messages.insert_one(doc)
    
    return whatsapp_msg.model_dump()

@api_router.put("/whatsapp/{message_id}/approve")
async def approve_whatsapp(message_id: str):
    """Approve a WhatsApp message (simulated send)"""
    result = await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": {"status": "approved"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await log_activity("whatsapp_approved", "whatsapp", message_id, {})
    return {"message": "Message approved and ready to send", "status": "approved"}

@api_router.put("/whatsapp/{message_id}/send")
async def send_whatsapp(message_id: str):
    """Simulate sending a WhatsApp message"""
    result = await db.whatsapp_messages.update_one(
        {"id": message_id},
        {"$set": {"status": "sent"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    await log_activity("whatsapp_sent", "whatsapp", message_id, {})
    return {"message": "Message sent successfully (simulated)", "status": "sent"}

@api_router.get("/whatsapp/{lead_id}")
async def get_lead_messages(lead_id: str):
    """Get all WhatsApp messages for a lead"""
    messages = await db.whatsapp_messages.find({"lead_id": lead_id}, {"_id": 0}).to_list(100)
    return messages

# ==================== PIPELINE ENDPOINTS ====================

@api_router.put("/pipeline/{lead_id}/stage")
async def update_pipeline_stage(lead_id: str, stage: str, probability: Optional[int] = None):
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
    await log_activity("pipeline_updated", "lead", lead_id, {"stage": stage})
    return lead

@api_router.get("/pipeline/stats")
async def get_pipeline_stats():
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
        
        stats[stage] = {"count": count, "avg_probability": round(avg_prob, 1)}
    
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

# ==================== ACTIVITY LOG ====================

async def log_activity(action: str, entity_type: str, entity_id: str, details: dict):
    """Log an activity for compliance"""
    log = ActivityLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details
    )
    await db.activity_logs.insert_one(log.model_dump())

@api_router.get("/activity-logs")
async def get_activity_logs(limit: int = 50):
    """Get recent activity logs"""
    logs = await db.activity_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
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
        "score_distribution": score_distribution
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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
