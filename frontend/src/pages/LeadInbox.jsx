import { useState, useEffect, useRef } from "react";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import DocumentRequestPanel from "../components/DocumentRequestPanel";
import { 
  Plus, 
  Phone, 
  MessageSquare,
  Calendar,
  Headphones,
  Send,
  Sparkles,
  Loader2,
  Bot,
  ChevronRight,
  Moon,
  Sun,
  Star,
  Paperclip,
  FileCheck,
  FileText
} from "lucide-react";

const LEAD_SOURCES = ["Property Finder", "Bayut", "Instagram", "WhatsApp", "Walk-in"];

// Urgent keywords that auto-bump to P1
const URGENT_KEYWORDS = ['immediately', 'urgent', 'today', 'asap', 'now', 'right away', 'quick', 'fast', 'hurry', 'emergency'];

/**
 * PRIORITY CALCULATION LOGIC (UPDATED):
 * ⭐ NEW = Lead created in last 30 minutes (highest priority - first contact window)
 * P1 🔥 = Contains urgent keywords OR (Score >85 AND contacted in last 30 mins)
 * P2 ⚡ = Score 65-85 OR has upcoming viewing OR (Score 60+ AND created < 60 mins)
 * P3 📞 = Score <65 OR no contact in 3+ days
 */
const calculatePriority = (lead) => {
  const score = (lead.score || 0) * 10; // Convert to 0-100 scale
  const createdAt = new Date(lead.created_at);
  const lastContact = lead.updated_at ? new Date(lead.updated_at) : createdAt;
  const now = new Date();
  const minutesSinceCreated = (now - createdAt) / (1000 * 60);
  const minutesSinceContact = (now - lastContact) / (1000 * 60);
  const daysSinceContact = minutesSinceContact / (60 * 24);
  
  // Check for urgent keywords in notes/description
  const textToCheck = `${lead.notes || ''} ${lead.maya_call_summary || ''} ${lead.ai_briefing || ''}`.toLowerCase();
  const hasUrgentKeyword = URGENT_KEYWORDS.some(keyword => textToCheck.includes(keyword));
  
  // Check for upcoming viewing in BANT timeline
  const timeline = (lead.maya_bant?.timeline || '').toLowerCase();
  const hasUpcomingViewing = timeline.includes('today') || timeline.includes('tomorrow') || 
                             timeline.includes('week') || timeline.includes('visiting');
  
  // ⭐ NEW: Lead created in last 30 minutes - HIGHEST PRIORITY
  if (minutesSinceCreated <= 30) {
    const minsRemaining = Math.max(0, Math.ceil(30 - minutesSinceCreated));
    return { 
      level: 'NEW', 
      icon: '⭐', 
      label: 'New', 
      color: 'bg-yellow-400', 
      textColor: 'text-yellow-500', 
      borderColor: 'border-yellow-400',
      countdown: minsRemaining
    };
  }
  
  // P1 🔥: Urgent keywords OR high score with recent contact
  if (hasUrgentKeyword || (score > 85 && minutesSinceContact <= 30)) {
    return { level: 'P1', icon: '🔥', label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-500', borderColor: 'border-red-500' };
  }
  
  // P2 ⚡: Medium-high score OR upcoming viewing OR new-ish lead with decent score
  // RULE: Score 60+ AND created < 60 mins = P2 minimum (never P3)
  if ((score >= 65 && score <= 85) || hasUpcomingViewing || lead.maya_call_status === 'completed' ||
      (score >= 60 && minutesSinceCreated <= 60)) {
    return { level: 'P2', icon: '⚡', label: 'Active', color: 'bg-amber-500', textColor: 'text-amber-500', borderColor: 'border-amber-500' };
  }
  
  // P3 📞: Low score OR stale contact
  if (score < 65 || daysSinceContact >= 3) {
    return { level: 'P3', icon: '📞', label: 'Follow-up', color: 'bg-blue-500', textColor: 'text-blue-500', borderColor: 'border-blue-500' };
  }
  
  // Default P2
  return { level: 'P2', icon: '⚡', label: 'Active', color: 'bg-amber-500', textColor: 'text-amber-500', borderColor: 'border-amber-500' };
};

/**
 * DYNAMIC "WHY NOW" TEXT - Must be UNIQUE and SPECIFIC per lead
 * Priority order ensures variety - first match wins
 */
const getWhyNow = (lead, priority) => {
  const createdAt = new Date(lead.created_at);
  const lastContact = lead.updated_at ? new Date(lead.updated_at) : createdAt;
  const now = new Date();
  const minutesSinceCreated = Math.floor((now - createdAt) / (1000 * 60));
  const hoursSinceCreated = Math.floor(minutesSinceCreated / 60);
  const hoursSinceContact = Math.floor((now - lastContact) / (1000 * 60 * 60));
  const daysSinceContact = Math.floor(hoursSinceContact / 24);
  
  const textToCheck = `${lead.notes || ''} ${lead.maya_call_summary || ''} ${lead.ai_briefing || ''}`.toLowerCase();
  const bant = lead.maya_bant || {};
  const budget = lead.estimated_deal_value || 0;
  const budgetStr = budget >= 1000000 ? `${(budget/1000000).toFixed(1)}M AED` : budget > 0 ? `${budget.toLocaleString()} AED` : null;
  const score = lead.score * 10;
  
  // ⭐ NEW leads - countdown timer (highest priority)
  if (priority.level === 'NEW') {
    return `First contact window: ${priority.countdown} mins remaining`;
  }
  
  // Perfect score - special callout
  if (score >= 100) {
    return `Perfect score — highest priority lead`;
  }
  
  // Check for urgent keywords ONLY if lead was created/updated in last 24 hours
  if (hoursSinceCreated <= 24 || hoursSinceContact <= 24) {
    for (const keyword of URGENT_KEYWORDS) {
      if (textToCheck.includes(keyword)) {
        return `Said "${keyword}" — respond within 1 hour`;
      }
    }
  }
  
  // Viewing scheduled - time sensitive
  if (bant.timeline) {
    const timeline = bant.timeline.toLowerCase();
    if (timeline.includes('today')) return `Viewing TODAY — confirm immediately`;
    if (timeline.includes('tomorrow')) return `Viewing tomorrow — send confirmation`;
    if (timeline.includes('2 hr') || timeline.includes('2hr')) return `Viewing in 2 hours — final prep`;
    if (timeline.includes('week')) return `Viewing this week — schedule exact time`;
  }
  
  // Maya qualified - always highlight this
  if (lead.maya_call_status === 'completed') {
    if (lead.maya_confidence_score >= 80) {
      return `Maya qualified ${lead.maya_confidence_score}% — hot, call now`;
    }
    return `Maya qualified this lead — review call summary`;
  }
  
  // HIGH BUDGET buyers - revenue priority (before stale contact check)
  if (budget >= 4000000) {
    return `High budget ${budgetStr} — revenue priority`;
  }
  
  // No contact warnings - be specific about days
  if (daysSinceContact >= 10) {
    return `No contact in ${daysSinceContact} days — going cold fast`;
  }
  if (daysSinceContact >= 5) {
    return `${daysSinceContact} days silent — re-engage today`;
  }
  if (daysSinceContact >= 3) {
    return `${daysSinceContact} days since contact — follow up`;
  }
  
  // Pre-approved buyer
  if (textToCheck.includes('pre-approved') || textToCheck.includes('preapproved')) {
    return `Pre-approved buyer — ready to transact`;
  }
  
  // New-ish lead (created < 2 hours)
  if (minutesSinceCreated <= 120) {
    return `New lead, ${minutesSinceCreated < 60 ? minutesSinceCreated + ' mins' : Math.floor(minutesSinceCreated/60) + 'h'} old — first contact`;
  }
  
  // International investor
  if (lead.language_preference && !['English', 'Arabic'].includes(lead.language_preference)) {
    return `${lead.language_preference} speaker — time zone sensitive`;
  }
  
  // High score without other signals
  if (score >= 90) {
    return `Score ${score} — top tier, prioritize`;
  }
  if (score >= 80) {
    return `Score ${score} — qualified, needs attention`;
  }
  
  // Budget confirmed (lower than 4M)
  if (budgetStr && budget >= 1000000) {
    return `Budget ${budgetStr} — send options`;
  }
  
  // Location interest
  const location = bant.location || lead.property_interests?.location;
  if (location) {
    return `Interested in ${location} — match properties`;
  }
  
  // Lead source specific
  if (lead.lead_source === 'Instagram' || lead.lead_source === 'WhatsApp') {
    return `${lead.lead_source} lead — quick response expected`;
  }
  
  // Recent activity
  if (hoursSinceContact <= 4) {
    return `Active ${hoursSinceContact}h ago — keep momentum`;
  }
  if (hoursSinceContact <= 24) {
    return `Last contact ${hoursSinceContact}h ago — check in`;
  }
  
  // Fallback - use days
  return `Last activity ${daysSinceContact || '<1'}d ago — review status`;
};

// Get time ago string
const getTimeAgo = (dateStr) => {
  if (!dateStr) return 'New';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return '1d';
  return `${days}d`;
};

// Get avatar color based on name
const getAvatarColor = (name) => {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500'
  ];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return colors[index];
};

// Get initials from name
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function LeadInbox() {
  const { api } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [darkMode, setDarkMode] = useState(false);
  const [voiceStats, setVoiceStats] = useState(null);
  const [docStatuses, setDocStatuses] = useState({}); // lead_id -> doc status
  const [docPanelLead, setDocPanelLead] = useState(null); // Lead to show doc panel for
  const containerRef = useRef(null);
  
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    language_preference: "English",
    lead_source: "Walk-in",
    estimated_deal_value: "",
    property_interests: { location: "", bedrooms: "", budget: "", property_type: "" },
    notes: ""
  });

  useEffect(() => {
    loadLeads();
    loadVoiceStats();
    // Refresh every minute to update countdowns
    const interval = setInterval(() => setLeads(l => [...l]), 60000);
    return () => clearInterval(interval);
  }, []);

  // Load document statuses after leads are loaded
  useEffect(() => {
    if (leads.length > 0) {
      loadDocumentStatuses();
    }
  }, [leads]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const response = await api.getLeads();
      setLeads(response.data);
    } catch (error) {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const loadVoiceStats = async () => {
    try {
      const response = await api.getVoiceStats();
      setVoiceStats(response.data);
    } catch (error) {
      console.error("Failed to load voice stats");
    }
  };

  const loadDocumentStatuses = async () => {
    // Load doc status for qualified leads (score > 65 or stage in qualified+)
    const qualifiedLeads = leads.filter(l => 
      l.score * 10 > 65 || ['qualified', 'viewing', 'negotiation', 'closing'].includes(l.stage)
    );
    
    const statuses = {};
    await Promise.all(
      qualifiedLeads.map(async (lead) => {
        try {
          const response = await api.getDocuments(lead.id);
          if (response.data?.exists) {
            statuses[lead.id] = response.data;
          }
        } catch (error) {
          // Ignore errors for individual leads
        }
      })
    );
    setDocStatuses(statuses);
  };

  const handleDocRequestSuccess = () => {
    loadDocumentStatuses();
  };

  const handleCreateLead = async () => {
    if (!newLead.name || !newLead.phone || !newLead.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const response = await api.createLead({
        ...newLead,
        estimated_deal_value: parseFloat(newLead.estimated_deal_value) || 0
      });
      setLeads([response.data, ...leads]);
      setShowAddDialog(false);
      setNewLead({
        name: "", phone: "", email: "", language_preference: "English",
        lead_source: "Walk-in", estimated_deal_value: "",
        property_interests: { location: "", bedrooms: "", budget: "", property_type: "" },
        notes: ""
      });
      toast.success(`Lead created with score: ${response.data.score}/10`);
      if (response.data.score > 7) {
        toast.info("Maya voice AI will contact this hot lead shortly", { duration: 5000 });
      }
    } catch (error) {
      toast.error("Failed to create lead");
    } finally {
      setCreating(false);
    }
  };

  // Process and sort leads by priority
  const processedLeads = leads.map(lead => {
    const priority = calculatePriority(lead);
    return {
      ...lead,
      priority,
      whyNow: getWhyNow(lead, priority),
      timeAgo: getTimeAgo(lead.updated_at || lead.created_at)
    };
  }).sort((a, b) => {
    // Sort order: NEW > P1 > P2 > P3
    const priorityOrder = { 'NEW': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
    if (priorityOrder[a.priority.level] !== priorityOrder[b.priority.level]) {
      return priorityOrder[a.priority.level] - priorityOrder[b.priority.level];
    }
    return (b.score || 0) - (a.score || 0);
  });

  // Filter counts
  const newCount = processedLeads.filter(l => l.priority.level === 'NEW').length;
  const urgentCount = processedLeads.filter(l => l.priority.level === 'P1').length;
  const mayaCount = processedLeads.filter(l => l.maya_call_status === 'completed').length;
  const viewingCount = processedLeads.filter(l => l.maya_bant?.timeline?.toLowerCase().includes('today')).length;
  const intlCount = processedLeads.filter(l => !['English', 'Arabic'].includes(l.language_preference)).length;
  const highBudgetCount = processedLeads.filter(l => l.estimated_deal_value >= 4000000).length;

  // Filter leads
  const getFilteredLeads = () => {
    switch(activeFilter) {
      case 'new': return processedLeads.filter(l => l.priority.level === 'NEW');
      case 'urgent': return processedLeads.filter(l => l.priority.level === 'P1');
      case 'maya': return processedLeads.filter(l => l.maya_call_status === 'completed');
      case 'viewing': return processedLeads.filter(l => l.maya_bant?.timeline?.toLowerCase().includes('today'));
      case 'international': return processedLeads.filter(l => !['English', 'Arabic'].includes(l.language_preference));
      case 'highbudget': return processedLeads.filter(l => l.estimated_deal_value >= 4000000);
      default: return processedLeads;
    }
  };
  const filteredLeads = getFilteredLeads();

  // Check criteria for badges
  const hasCriteria = (lead, type) => {
    const bant = lead.maya_bant || {};
    const interests = lead.property_interests || {};
    switch(type) {
      case 'budget': return bant.budget || interests.budget || lead.estimated_deal_value > 0;
      case 'area': return bant.location || interests.location;
      case 'timeline': return bant.timeline;
      default: return false;
    }
  };

  const bgColor = darkMode ? 'bg-[#0B141A]' : 'bg-gray-50';
  const cardBg = darkMode ? 'bg-[#1F2C34]' : 'bg-white';
  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900';
  const textMuted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = darkMode ? 'border-[#2A3942]' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgColor} transition-colors duration-300`} ref={containerRef}>
      {/* Compact Header */}
      <div className={`sticky top-0 z-20 ${cardBg} border-b ${borderColor} px-4 py-2`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className={`text-lg font-bold ${textColor}`}>Action Queue</h1>
            <p className={`text-xs ${textMuted}`}>{leads.length} leads</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className={`rounded-full h-8 w-8 ${textMuted}`} data-testid="dark-mode-toggle">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-lead-btn" className="bg-[#00A884] hover:bg-[#00A884]/90 text-white rounded-full h-8 px-3 text-sm">
                  <Plus className="w-3 h-3 mr-1" />Add
                </Button>
              </DialogTrigger>
              <DialogContent className={`max-w-md max-h-[85vh] overflow-y-auto ${darkMode ? 'bg-[#1F2C34] text-white border-[#2A3942]' : ''}`}>
                <DialogHeader><DialogTitle className={darkMode ? 'text-white' : ''}>Add New Lead</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className={`text-xs ${textMuted}`}>Name *</Label><Input data-testid="lead-name-input" placeholder="Ahmed Al Rashid" value={newLead.name} onChange={(e) => setNewLead({...newLead, name: e.target.value})} className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}/></div>
                    <div><Label className={`text-xs ${textMuted}`}>Phone *</Label><Input data-testid="lead-phone-input" placeholder="+971 50 123 4567" value={newLead.phone} onChange={(e) => setNewLead({...newLead, phone: e.target.value})} className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}/></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className={`text-xs ${textMuted}`}>Email *</Label><Input data-testid="lead-email-input" type="email" placeholder="ahmed@example.com" value={newLead.email} onChange={(e) => setNewLead({...newLead, email: e.target.value})} className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}/></div>
                    <div><Label className={`text-xs ${textMuted}`}>Deal Value (AED)</Label><Input data-testid="lead-deal-value-input" type="number" placeholder="5000000" value={newLead.estimated_deal_value} onChange={(e) => setNewLead({...newLead, estimated_deal_value: e.target.value})} className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}/></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className={`text-xs ${textMuted}`}>Language</Label>
                      <Select value={newLead.language_preference} onValueChange={(val) => setNewLead({...newLead, language_preference: val})}>
                        <SelectTrigger className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}><SelectValue /></SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {["English", "Arabic", "Hindi", "Russian", "Mandarin", "French"].map(l => <SelectItem key={l} value={l} className={darkMode ? 'text-white' : ''}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className={`text-xs ${textMuted}`}>Source</Label>
                      <Select value={newLead.lead_source} onValueChange={(val) => setNewLead({...newLead, lead_source: val})}>
                        <SelectTrigger className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}><SelectValue /></SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {LEAD_SOURCES.map(s => <SelectItem key={s} value={s} className={darkMode ? 'text-white' : ''}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className={`text-xs ${textMuted}`}>Location</Label>
                      <Select value={newLead.property_interests.location} onValueChange={(val) => setNewLead({...newLead, property_interests: {...newLead.property_interests, location: val}})}>
                        <SelectTrigger className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}><SelectValue placeholder="Area" /></SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {["Palm Jumeirah", "Downtown Dubai", "Dubai Hills", "Dubai Marina", "JBR", "Business Bay"].map(l => <SelectItem key={l} value={l} className={darkMode ? 'text-white' : ''}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className={`text-xs ${textMuted}`}>Property Type</Label>
                      <Select value={newLead.property_interests.property_type} onValueChange={(val) => setNewLead({...newLead, property_interests: {...newLead.property_interests, property_type: val}})}>
                        <SelectTrigger className={`h-9 ${darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}`}><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {["Apartment", "Villa", "Townhouse", "Penthouse", "Studio"].map(t => <SelectItem key={t} value={t} className={darkMode ? 'text-white' : ''}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label className={`text-xs ${textMuted}`}>Notes (include "urgent", "today" etc. to auto-prioritize)</Label>
                    <Textarea data-testid="lead-notes-input" placeholder="e.g., Looking immediately for 3BR villa" value={newLead.notes} onChange={(e) => setNewLead({...newLead, notes: e.target.value})} rows={2} className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}/>
                  </div>
                  <Button data-testid="submit-lead-btn" onClick={handleCreateLead} disabled={creating} className="w-full bg-[#00A884] hover:bg-[#00A884]/90 text-white rounded-full h-9">
                    {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scoring...</> : <><Sparkles className="w-4 h-4 mr-2" />Add & Score</>}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto pb-28 sm:pb-20">
        {/* Urgent Banner - Only show if there are NEW or P1 leads */}
        {(newCount > 0 || urgentCount > 0) && (
          <div className="mx-3 mt-3 p-2.5 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl text-white">
            <div className="flex items-center gap-2 text-sm font-medium">
              {newCount > 0 && <span>⭐ {newCount} new lead{newCount > 1 ? 's' : ''} — first contact window open</span>}
              {newCount > 0 && urgentCount > 0 && <span className="opacity-60">•</span>}
              {urgentCount > 0 && <span>🔥 {urgentCount} urgent</span>}
            </div>
          </div>
        )}

        {/* Maya Activity Strip */}
        {voiceStats && voiceStats.total_calls > 0 && (
          <Link to="/voice-ai" className="block mx-3 mt-2">
            <div className={`p-2 ${darkMode ? 'bg-[#1F2C34] border-[#2A3942]' : 'bg-white border-gray-200'} border rounded-lg flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                <span className={`text-xs ${textMuted}`}>
                  <span className="text-purple-500 font-medium">Maya</span> {voiceStats.total_calls} calls • {voiceStats.qualified_interested} qualified
                </span>
              </div>
              <ChevronRight className={`w-3 h-3 ${textMuted}`} />
            </div>
          </Link>
        )}

        {/* Filter Pills with counts */}
        <div className="px-3 mt-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 pb-2">
            {[
              { id: 'all', label: 'All', count: processedLeads.length },
              { id: 'new', label: '⭐ New', count: newCount },
              { id: 'urgent', label: '🔥 Urgent', count: urgentCount },
              { id: 'maya', label: '🤖 Maya', count: mayaCount },
              { id: 'viewing', label: '📅 Today', count: viewingCount },
              { id: 'international', label: '🌍 Intl', count: intlCount },
              { id: 'highbudget', label: '💰 4M+', count: highBudgetCount },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                data-testid={`filter-${filter.id}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === filter.id
                    ? 'bg-[#00A884] text-white'
                    : darkMode ? 'bg-[#2A3942] text-gray-300' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        </div>

        {/* Compact Lead Cards */}
        <div className="mt-2 space-y-1.5 px-3">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className={`${cardBg} rounded-xl p-3 animate-pulse`}>
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-300 rounded w-1/3" />
                    <div className="h-2.5 bg-gray-200 rounded w-2/3" />
                  </div>
                  <div className="flex gap-1">
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredLeads.length === 0 ? (
            <div className={`${cardBg} rounded-xl p-6 text-center`}>
              <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className={`text-sm font-medium ${textColor}`}>No leads in this view</p>
            </div>
          ) : (
            filteredLeads.map((lead, index) => (
              <div
                key={lead.id}
                data-testid={`lead-card-${lead.id}`}
                className={`${cardBg} rounded-xl overflow-hidden border-l-4 ${lead.priority.borderColor} shadow-sm hover:shadow-md transition-all duration-200 animate-slide-up`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Single Row Card - Avatar + Info + Actions inline */}
                <div className="p-3 flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {getInitials(lead.name)}
                  </div>
                  
                  {/* Info - Compact */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Priority + Name + Time */}
                    <div className="flex items-start gap-1.5 flex-wrap sm:flex-nowrap">
                      <span className={`text-xs font-bold ${lead.priority.textColor} flex-shrink-0`}>{lead.priority.icon} {lead.priority.level}</span>
                      <Link to={`/leads/${lead.id}`} className={`font-semibold text-sm ${textColor} hover:underline break-words sm:truncate`}>{lead.name}</Link>
                      <span className={`text-[10px] ${textMuted} ml-auto flex-shrink-0`}>{lead.timeAgo}</span>
                    </div>
                    
                    {/* Row 2: Score + Criteria + Doc Status */}
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-xs font-semibold ${lead.score >= 8 ? 'text-red-500' : lead.score >= 6 ? 'text-amber-500' : 'text-blue-500'}`}>
                        {lead.score * 10}
                      </span>
                      <span className={`text-[10px] ${textMuted}`}>•</span>
                      <span className="text-[10px]">{hasCriteria(lead, 'budget') ? '💰' : '○'}</span>
                      <span className="text-[10px]">{hasCriteria(lead, 'area') ? '📍' : '○'}</span>
                      <span className="text-[10px]">{hasCriteria(lead, 'timeline') ? '⏰' : '○'}</span>
                      {lead.maya_call_status === 'completed' && <span className="text-[10px]">🤖</span>}
                      {/* Document Status Badge */}
                      {docStatuses[lead.id] && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          docStatuses[lead.id].status === 'complete' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        }`}>
                          📎 {docStatuses[lead.id].received_docs?.length || 0}/{docStatuses[lead.id].requested_docs?.length || 0}
                          {docStatuses[lead.id].status === 'complete' && ' ✅'}
                        </span>
                      )}
                    </div>
                    
                    {/* Row 3: WHY NOW */}
                    <div className={`mt-1 text-[11px] font-semibold ${lead.priority.level === 'NEW' ? 'text-yellow-600' : darkMode ? 'text-amber-400' : 'text-amber-700'} truncate`}>
                      {lead.whyNow}
                    </div>
                  </div>
                  
                  {/* Action Buttons - Icon only on mobile-ish, compact */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Request Docs button - only for qualified leads (score > 65) */}
                    {(lead.score * 10 > 65 || ['qualified', 'viewing', 'negotiation'].includes(lead.stage)) && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={`h-8 w-8 rounded-full ${
                          docStatuses[lead.id]?.status === 'complete'
                            ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/20'
                            : docStatuses[lead.id]
                              ? 'text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/20'
                              : 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/20'
                        }`} 
                        onClick={() => setDocPanelLead(lead)}
                        data-testid={`request-docs-${lead.id}`}
                      >
                        {docStatuses[lead.id]?.status === 'complete' ? (
                          <FileCheck className="w-4 h-4" />
                        ) : docStatuses[lead.id] ? (
                          <FileText className="w-4 h-4" />
                        ) : (
                          <Paperclip className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <a href={`tel:${lead.phone}`}>
                      <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${darkMode ? 'hover:bg-green-500/20 text-green-400' : 'hover:bg-green-50 text-green-600'}`} data-testid={`call-${lead.id}`}>
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                    <a href={`https://wa.me/${lead.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${darkMode ? 'hover:bg-[#25D366]/20 text-[#25D366]' : 'hover:bg-[#25D366]/10 text-[#25D366]'}`} data-testid={`whatsapp-${lead.id}`}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </a>
                    {lead.maya_call_status === 'completed' && lead.maya_recording_url ? (
                      <a href={lead.maya_recording_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${darkMode ? 'hover:bg-purple-500/20 text-purple-400' : 'hover:bg-purple-50 text-purple-600'}`} data-testid={`listen-${lead.id}`}>
                          <Headphones className="w-4 h-4" />
                        </Button>
                      </a>
                    ) : (
                      <Link to={`/leads/${lead.id}`}>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${darkMode ? 'hover:bg-amber-500/20 text-amber-400' : 'hover:bg-amber-50 text-amber-600'}`} data-testid={`view-${lead.id}`}>
                          <Calendar className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Document Request Panel */}
      <DocumentRequestPanel
        lead={docPanelLead}
        isOpen={!!docPanelLead}
        onClose={() => setDocPanelLead(null)}
        onSuccess={handleDocRequestSuccess}
      />

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; opacity: 0; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
