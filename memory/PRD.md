# PropBoost AI - Product Requirements Document

## Overview
PropBoost AI is a B2B SaaS platform for Dubai real estate agents providing AI-powered lead qualification, multilingual content generation, pipeline management, and now **omnichannel outreach** capabilities.

## Original Problem Statement
Build an AI productivity suite for mid-tier Dubai real estate agents (1-20 agent brokerages) handling 10-50 transactions/year. Must support Arabic/English/Hindi/Russian/Mandarin/French and comply with RERA/DLD regulations.

## User Personas
1. **Solo Agent** - Individual agent managing 50-100 leads/month
2. **Team Lead** - Manages 3-5 agents, needs pipeline visibility
3. **Brokerage Owner** - 10-20 agents, needs analytics and compliance

## Core Requirements (Static)
- AI Lead Scoring (1-10 scale with Hot/Warm/Cold routing)
- Multilingual Content Generation (6 languages, 5 platforms)
- Visual Pipeline Tracker (Kanban with drag-drop)
- Agent Approval Workflow (RERA compliance)
- Mobile-responsive design
- **Omnichannel Outreach** (Voice → WhatsApp → SMS → Email)
- **Automated Follow-ups** (Day 1 → Day 2 → Day 4 → Day 7)
- **Maya Learning Engine** (Conversation analysis & pattern detection)

## What's Been Implemented

### Phase 1 MVP (Feb 2026)
- ✅ Lead CRUD with AI scoring via Claude Sonnet 4.5
- ✅ Property management CRUD
- ✅ Multilingual content generation (Instagram, Facebook, WhatsApp, Email, SEO)
- ✅ Content approval workflow
- ✅ WhatsApp message generation (simulated)
- ✅ Pipeline stage management with probability tracking
- ✅ Activity logging for compliance
- ✅ Dashboard with stats cards and charts
- ✅ Lead Inbox with Hot/Warm/Cold tabs
- ✅ Content Studio with property form and multilingual preview
- ✅ Pipeline Tracker (Kanban board)
- ✅ Navy/Gold Dubai luxury theme
- ✅ Mobile-responsive navigation

### Phase 2 Operational Beta (Feb 2026)
- ✅ JWT-based email/password authentication
- ✅ Google OAuth via Emergent-managed auth
- ✅ Protected routes requiring authentication
- ✅ Lead Leaderboard Analytics module
- ✅ Voice AI "Maya" integration (Vapi.ai with Twilio carrier)
- ✅ Auto-trigger Maya calls for hot leads (score > 7)
- ✅ Voice AI Dashboard (Total Calls, Answered, Qualification Rate, AI Confidence, Avg Talk Time)
- ✅ BANT Summary Display - Beautiful visualization of Budget, Authority, Need, Timeline
- ✅ AI Confidence Score - Percentage confidence based on call quality
- ✅ High-Velocity Action Feed - Priority queue for hot leads
- ✅ WhatsApp Handoff - One-click export of BANT data
- ✅ RERA 2026 Compliance - compliance_status field
- ✅ Password Reset Flow

### Phase 3 - Omnichannel System (Feb 27, 2026) ✨ NEW
- ✅ **Gap 1: Omnichannel Outreach Sequence**
  - Voice Call (immediate) → WhatsApp/SMS (2 min) → SMS (10 min) → Email (1 hour)
  - OutreachSequence model with step tracking
  - API endpoints: /api/outreach/sequences, /api/outreach/stats
  - Frontend page: /omnichannel with sequence management UI
  - Twilio SMS integration (real or simulated)
  - Email integration (simulated)

- ✅ **Gap 2: Automated Follow-up Cadences**
  - Day 1 (Trigger) → Day 2 (WhatsApp) → Day 4 (Voice) → Day 7 (Email)
  - FollowUpCadence model with day completion tracking
  - API endpoints: /api/followups/cadences, /api/followups/stats
  - Frontend page: /followups with cadence timeline visualization
  - Native backend scheduled jobs (no external dependencies)

- ✅ **Gap 3: Maya Learning Engine**
  - ConversationLog model with BANT extraction and outcomes
  - Broker rating system (1-5 stars with feedback)
  - Deal status tracking (pending/won/lost) with value
  - Pattern analytics (qualification rate, confidence, success patterns)
  - API endpoints: /api/learning/conversations, /api/learning/patterns, /api/learning/stats
  - Frontend page: /maya-learning with analytics dashboard and rating modal

### Integrations Status
- ✅ Claude Sonnet 4.5 (via Emergent LLM key) - ACTIVE
- ✅ Google OAuth (via Emergent Auth) - ACTIVE
- ✅ Vapi AI Voice API - CONFIGURED & WORKING (Maya assistant)
- ✅ Twilio SMS - CONFIGURED (real or simulated)
- ✅ Twilio (as carrier for Vapi) - CONFIGURED
- ⏸️ Twilio WhatsApp API - PLUG-AND-PLAY (need WhatsApp Business number)
- ⏸️ SendGrid Email API - PLUG-AND-PLAY (using simulated email)

## Technical Architecture
- **Frontend**: React 19, Tailwind CSS, Shadcn UI, Recharts, Lucide Icons
- **Backend**: FastAPI, Motor (async MongoDB), Pydantic, JWT
- **AI**: Claude Sonnet 4.5 via emergentintegrations
- **Auth**: JWT + Emergent Google OAuth
- **Database**: MongoDB
- **Voice AI**: Vapi.ai + Twilio carrier (LIVE)
- **Messaging**: Twilio SMS (real/simulated), Simulated Email
- **Fonts**: Playfair Display (headings), Outfit (body), Tajawal (Arabic)

## API Endpoints (New in Phase 3)

### Omnichannel Outreach
- `POST /api/outreach/sequences` - Create new sequence
- `GET /api/outreach/sequences` - List all sequences
- `GET /api/outreach/sequences/{id}` - Get sequence details
- `POST /api/outreach/sequences/{id}/execute-step` - Execute next step
- `PUT /api/outreach/sequences/{id}/pause` - Pause sequence
- `PUT /api/outreach/sequences/{id}/resume` - Resume sequence
- `PUT /api/outreach/sequences/{id}/cancel` - Cancel sequence
- `GET /api/outreach/stats` - Get outreach statistics

### Follow-up Cadences
- `POST /api/followups/cadences` - Create new cadence
- `GET /api/followups/cadences` - List all cadences
- `GET /api/followups/cadences/{id}` - Get cadence details
- `POST /api/followups/cadences/{id}/execute-day` - Execute specific day
- `PUT /api/followups/cadences/{id}/mark-responded` - Mark lead responded
- `PUT /api/followups/cadences/{id}/cancel` - Cancel cadence
- `GET /api/followups/stats` - Get follow-up statistics

### Maya Learning Engine
- `POST /api/learning/conversations` - Log a conversation
- `GET /api/learning/conversations` - Get conversation logs
- `POST /api/learning/conversations/{id}/rate` - Rate conversation
- `GET /api/learning/patterns` - Get learning patterns
- `GET /api/learning/stats` - Get learning statistics

## Navigation Structure
1. Dashboard
2. Lead Inbox
3. Content Studio
4. Pipeline
5. Analytics
6. Voice AI
7. **Omnichannel** (NEW)
8. **Follow-ups** (NEW)
9. **Maya Learning** (NEW)

## Prioritized Backlog

### P0 - Critical (Immediate)
- Infrastructure: Backend API routing needs to be working via public URL

### P1 - High Priority (Next Sprint)
- Real WhatsApp Business API integration
- Real SendGrid Email integration
- Background job scheduler (APScheduler) for automated sequence execution

### P2 - Medium Priority (Future)
- Property Portal API Sync (Property Finder, Bayut)
- Social media auto-publishing
- Team collaboration features
- Advanced predictive analytics

### P3 - Backlog
- Mobile app (React Native)
- Multi-tenant architecture improvements
- Real-time WebSocket notifications
- 10-Language Expansion (Russian, Mandarin)

## Environment Variables (Backend)
```
# Required (configured)
MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, JWT_SECRET

# Vapi Voice AI (configured)
VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID

# Twilio SMS (configured - real or simulated)
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

# Plug-and-Play (add when ready)
TWILIO_WHATSAPP_NUMBER (for WhatsApp Business)
SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
```

## Pricing Tiers (Planned)
- Solo: AED 999/month (1 agent, 100 leads/month)
- Team: AED 2,499/month (5 agents, 500 leads/month)
- Enterprise: AED 4,999/month (20 agents, unlimited)

---
*Last Updated: February 27, 2026*
