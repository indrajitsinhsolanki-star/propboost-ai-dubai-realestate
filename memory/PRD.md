# PropBoost AI - Product Requirements Document

## Overview
PropBoost AI is a B2B SaaS platform for Dubai real estate agents providing AI-powered lead qualification, multilingual content generation, and pipeline management.

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
- ✅ New lead fields: lead_source, estimated_deal_value
- ✅ Conversion rate and revenue tracking by source
- ✅ Voice AI "Maya" integration (Retell AI - PLUG-AND-PLAY)
- ✅ Auto-trigger Maya calls for hot leads (score > 7)
- ✅ Twilio WhatsApp integration (PLUG-AND-PLAY)
- ✅ SendGrid Email integration (PLUG-AND-PLAY)
- ✅ RERA/DLD compliance validation (blocks investment guarantees)
- ✅ AI-generated content disclaimer enforcement
- ✅ Compliance audit trail logging
- ✅ User profile display in sidebar
- ✅ Logout functionality

### Integrations Status
- ✅ Claude Sonnet 4.5 (via Emergent LLM key) - ACTIVE
- ✅ Google OAuth (via Emergent Auth) - ACTIVE
- ✅ Vapi AI Voice API - CONFIGURED & WORKING (Maya assistant for lead qualification)
- ✅ Twilio (as carrier for Vapi) - CONFIGURED
- ⏸️ Twilio WhatsApp API - PLUG-AND-PLAY (need WhatsApp Business number)
- ⏸️ SendGrid Email API - PLUG-AND-PLAY (add credentials when ready)

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- Property portal API sync (Property Finder, Bayut)
- Social media auto-publishing (Meta Business API)
- Automated follow-up sequences

### P1 - High Priority
- Team collaboration features
- Advanced reporting dashboard
- Multi-tenant architecture
- Real-time notifications

### P2 - Medium Priority
- Predictive deal analytics with ML
- CRM integrations (Salesforce, HubSpot)
- Payment processing for subscriptions
- Mobile app (React Native)
- Arabic RTL full support

## Technical Architecture
- **Frontend**: React 19, Tailwind CSS, Shadcn UI, Recharts
- **Backend**: FastAPI, Motor (async MongoDB), Pydantic, JWT
- **AI**: Claude Sonnet 4.5 via emergentintegrations
- **Auth**: JWT + Emergent Google OAuth
- **Database**: MongoDB
- **Voice AI**: Retell AI (plug-and-play)
- **Messaging**: Twilio WhatsApp, SendGrid Email (plug-and-play)
- **Fonts**: Playfair Display (headings), Outfit (body), Tajawal (Arabic)

## Environment Variables (Backend)
```
# Required (configured)
MONGO_URL, DB_NAME, EMERGENT_LLM_KEY, JWT_SECRET

# Plug-and-Play (add when ready)
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
RETELL_API_KEY, RETELL_AGENT_ID, RETELL_FROM_NUMBER
```

## Pricing Tiers (Planned)
- Solo: AED 999/month (1 agent, 100 leads/month)
- Team: AED 2,499/month (5 agents, 500 leads/month)
- Enterprise: AED 4,999/month (20 agents, unlimited)

## Next Tasks
1. Add property portal API integrations (Property Finder, Bayut)
2. Implement automated follow-up sequences
3. Add real-time notifications (WebSocket)
4. Build team collaboration features
5. Add advanced predictive analytics
