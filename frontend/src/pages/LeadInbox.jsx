import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Phone, 
  Mail, 
  MessageSquare,
  Calendar,
  Headphones,
  FileText,
  Send,
  Sparkles,
  Loader2,
  Bot,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe,
  ChevronRight,
  Moon,
  Sun
} from "lucide-react";

const LEAD_SOURCES = ["Property Finder", "Bayut", "Instagram", "WhatsApp", "Walk-in"];

/**
 * PRIORITY CALCULATION LOGIC:
 * P1 🔥 = Score >85 (8.5/10) AND contacted in last 30 mins
 * P2 ⚡ = Score 65-85 (6.5-8.5/10) OR has upcoming viewing/visit
 * P3 📞 = Score <65 OR no contact in 3+ days
 * Unassigned = New leads with no score yet
 */
const calculatePriority = (lead) => {
  const score = (lead.score || 0) * 10; // Convert to 0-100 scale
  const lastContact = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at);
  const now = new Date();
  const minutesSinceContact = (now - lastContact) / (1000 * 60);
  const daysSinceContact = minutesSinceContact / (60 * 24);
  
  // Check for upcoming viewing in BANT timeline
  const hasUpcomingViewing = lead.maya_bant?.timeline?.toLowerCase().includes('today') ||
                             lead.maya_bant?.timeline?.toLowerCase().includes('tomorrow') ||
                             lead.maya_bant?.timeline?.toLowerCase().includes('week') ||
                             lead.maya_bant?.timeline?.toLowerCase().includes('visiting');
  
  // P1: Hot - High score AND recent contact
  if (score > 85 && minutesSinceContact <= 30) {
    return { level: 'P1', icon: '🔥', label: 'Urgent', color: 'bg-red-500', textColor: 'text-red-500', borderColor: 'border-red-500' };
  }
  
  // P2: Active - Medium-high score OR has upcoming activity
  if ((score >= 65 && score <= 85) || hasUpcomingViewing || lead.maya_call_status === 'completed') {
    return { level: 'P2', icon: '⚡', label: 'Active', color: 'bg-amber-500', textColor: 'text-amber-500', borderColor: 'border-amber-500' };
  }
  
  // P3: Follow-up needed - Low score OR stale contact
  if (score < 65 || daysSinceContact >= 3) {
    return { level: 'P3', icon: '📞', label: 'Follow-up', color: 'bg-blue-500', textColor: 'text-blue-500', borderColor: 'border-blue-500' };
  }
  
  // Default P2 for others
  return { level: 'P2', icon: '⚡', label: 'Active', color: 'bg-amber-500', textColor: 'text-amber-500', borderColor: 'border-amber-500' };
};

// Generate "WHY NOW" reason
const getWhyNow = (lead) => {
  const lastContact = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at);
  const now = new Date();
  const hoursSinceContact = (now - lastContact) / (1000 * 60 * 60);
  const daysSinceContact = hoursSinceContact / 24;
  
  // Check BANT data for urgency signals
  if (lead.maya_bant?.timeline) {
    const timeline = lead.maya_bant.timeline.toLowerCase();
    if (timeline.includes('today') || timeline.includes('2 hr') || timeline.includes('urgent')) {
      return `Viewing in ${lead.maya_bant.timeline}`;
    }
    if (timeline.includes('tomorrow')) {
      return 'Viewing scheduled tomorrow';
    }
    if (timeline.includes('week') || timeline.includes('visiting')) {
      return `${lead.maya_bant.timeline} - act now`;
    }
  }
  
  // Pre-approved buyers are hot
  if (lead.notes?.toLowerCase().includes('pre-approved') || 
      lead.maya_call_summary?.toLowerCase().includes('pre-approved')) {
    return 'Pre-approved buyer ready to move';
  }
  
  // High score + recent = hot
  if (lead.score >= 9 && hoursSinceContact <= 2) {
    return 'Hot lead - respond within 2 hrs';
  }
  
  // Maya qualified
  if (lead.maya_call_status === 'completed' && lead.maya_confidence_score >= 70) {
    return 'Maya qualified - high confidence';
  }
  
  // No contact warning
  if (daysSinceContact >= 3) {
    return `No contact in ${Math.floor(daysSinceContact)} days`;
  }
  
  // International investor
  if (lead.maya_bant?.location?.toLowerCase().includes('india') ||
      lead.maya_bant?.location?.toLowerCase().includes('abroad') ||
      lead.language_preference !== 'English' && lead.language_preference !== 'Arabic') {
    return 'International investor - time sensitive';
  }
  
  // Default based on score
  if (lead.score >= 8) return 'High-value lead needs attention';
  if (lead.score >= 6) return 'Warm lead - nurture today';
  return 'Follow-up recommended';
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
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
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
  const containerRef = useRef(null);
  
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    language_preference: "English",
    lead_source: "Walk-in",
    estimated_deal_value: "",
    property_interests: {
      location: "",
      bedrooms: "",
      budget: "",
      property_type: ""
    },
    notes: ""
  });

  useEffect(() => {
    loadLeads();
    loadVoiceStats();
  }, []);

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
        name: "",
        phone: "",
        email: "",
        language_preference: "English",
        lead_source: "Walk-in",
        estimated_deal_value: "",
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
  const processedLeads = leads.map(lead => ({
    ...lead,
    priority: calculatePriority(lead),
    whyNow: getWhyNow(lead),
    timeAgo: getTimeAgo(lead.updated_at || lead.created_at)
  })).sort((a, b) => {
    // Sort by priority level first (P1 > P2 > P3)
    const priorityOrder = { 'P1': 0, 'P2': 1, 'P3': 2 };
    if (priorityOrder[a.priority.level] !== priorityOrder[b.priority.level]) {
      return priorityOrder[a.priority.level] - priorityOrder[b.priority.level];
    }
    // Then by score
    return (b.score || 0) - (a.score || 0);
  });

  // Filter leads based on active filter
  const getFilteredLeads = () => {
    switch(activeFilter) {
      case 'urgent':
        return processedLeads.filter(l => l.priority.level === 'P1');
      case 'maya':
        return processedLeads.filter(l => l.maya_call_status === 'completed');
      case 'viewing':
        return processedLeads.filter(l => 
          l.maya_bant?.timeline?.toLowerCase().includes('today') ||
          l.maya_bant?.timeline?.toLowerCase().includes('viewing')
        );
      case 'international':
        return processedLeads.filter(l => 
          !['English', 'Arabic'].includes(l.language_preference) ||
          l.maya_bant?.location?.toLowerCase().includes('india') ||
          l.maya_bant?.location?.toLowerCase().includes('abroad')
        );
      case 'highbudget':
        return processedLeads.filter(l => l.estimated_deal_value >= 4000000);
      default:
        return processedLeads;
    }
  };

  const filteredLeads = getFilteredLeads();
  
  // Calculate urgent count (P1 leads)
  const urgentCount = processedLeads.filter(l => l.priority.level === 'P1').length;
  const mayaCalledToday = voiceStats?.total_calls || 0;
  const mayaQualified = voiceStats?.qualified_interested || 0;
  const mayaFollowUp = voiceStats?.qualified_callback || 0;

  // Check criteria for badges
  const hasCriteria = (lead, type) => {
    const bant = lead.maya_bant || {};
    const interests = lead.property_interests || {};
    
    switch(type) {
      case 'budget':
        return bant.budget || interests.budget || lead.estimated_deal_value > 0;
      case 'area':
        return bant.location || interests.location;
      case 'timeline':
        return bant.timeline;
      default:
        return false;
    }
  };

  // Get last message/summary preview
  const getLastMessage = (lead) => {
    if (lead.maya_call_summary) {
      return lead.maya_call_summary.substring(0, 100) + (lead.maya_call_summary.length > 100 ? '...' : '');
    }
    if (lead.notes) {
      return lead.notes.substring(0, 100) + (lead.notes.length > 100 ? '...' : '');
    }
    const interests = lead.property_interests || {};
    if (interests.location || interests.property_type) {
      return `Looking for ${interests.bedrooms || ''} ${interests.property_type || 'property'} in ${interests.location || 'Dubai'}`;
    }
    return 'New lead - awaiting details';
  };

  const bgColor = darkMode ? 'bg-[#0B141A]' : 'bg-gray-50';
  const cardBg = darkMode ? 'bg-[#1F2C34]' : 'bg-white';
  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900';
  const textMuted = darkMode ? 'text-gray-400' : 'text-gray-500';
  const borderColor = darkMode ? 'border-[#2A3942]' : 'border-gray-200';

  return (
    <div className={`min-h-screen ${bgColor} transition-colors duration-300`} ref={containerRef}>
      {/* Header */}
      <div className={`sticky top-0 z-20 ${cardBg} border-b ${borderColor} px-4 py-3`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-bold ${textColor}`}>Action Queue</h1>
            <p className={`text-sm ${textMuted}`}>{leads.length} leads</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className={`rounded-full ${textMuted}`}
              data-testid="dark-mode-toggle"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button 
                  data-testid="add-lead-btn"
                  className="bg-[#00A884] hover:bg-[#00A884]/90 text-white rounded-full"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Lead
                </Button>
              </DialogTrigger>
              <DialogContent className={`max-w-lg max-h-[90vh] overflow-y-auto ${darkMode ? 'bg-[#1F2C34] text-white border-[#2A3942]' : ''}`}>
                <DialogHeader>
                  <DialogTitle className={darkMode ? 'text-white' : ''}>Add New Lead</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className={textMuted}>Full Name *</Label>
                      <Input
                        data-testid="lead-name-input"
                        placeholder="Ahmed Al Rashid"
                        value={newLead.name}
                        onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                        className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className={textMuted}>Phone *</Label>
                      <Input
                        data-testid="lead-phone-input"
                        placeholder="+971 50 123 4567"
                        value={newLead.phone}
                        onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                        className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className={textMuted}>Email *</Label>
                      <Input
                        data-testid="lead-email-input"
                        type="email"
                        placeholder="ahmed@example.com"
                        value={newLead.email}
                        onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                        className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className={textMuted}>Deal Value (AED)</Label>
                      <Input
                        data-testid="lead-deal-value-input"
                        type="number"
                        placeholder="5000000"
                        value={newLead.estimated_deal_value}
                        onChange={(e) => setNewLead({...newLead, estimated_deal_value: e.target.value})}
                        className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className={textMuted}>Language</Label>
                      <Select value={newLead.language_preference} onValueChange={(val) => setNewLead({...newLead, language_preference: val})}>
                        <SelectTrigger data-testid="lead-language-select" className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {["English", "Arabic", "Hindi", "Russian", "Mandarin", "French"].map(lang => (
                            <SelectItem key={lang} value={lang} className={darkMode ? 'text-white hover:bg-[#3B4A54]' : ''}>{lang}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className={textMuted}>Source</Label>
                      <Select value={newLead.lead_source} onValueChange={(val) => setNewLead({...newLead, lead_source: val})}>
                        <SelectTrigger data-testid="lead-source-select" className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {LEAD_SOURCES.map(src => (
                            <SelectItem key={src} value={src} className={darkMode ? 'text-white hover:bg-[#3B4A54]' : ''}>{src}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className={textMuted}>Location</Label>
                      <Select 
                        value={newLead.property_interests.location}
                        onValueChange={(val) => setNewLead({...newLead, property_interests: {...newLead.property_interests, location: val}})}
                      >
                        <SelectTrigger data-testid="lead-location-select" className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}>
                          <SelectValue placeholder="Select area" />
                        </SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {["Palm Jumeirah", "Downtown Dubai", "Dubai Hills", "Dubai Marina", "JBR", "Business Bay"].map(loc => (
                            <SelectItem key={loc} value={loc} className={darkMode ? 'text-white hover:bg-[#3B4A54]' : ''}>{loc}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className={textMuted}>Property Type</Label>
                      <Select 
                        value={newLead.property_interests.property_type}
                        onValueChange={(val) => setNewLead({...newLead, property_interests: {...newLead.property_interests, property_type: val}})}
                      >
                        <SelectTrigger data-testid="lead-property-type-select" className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className={darkMode ? 'bg-[#2A3942] border-[#3B4A54]' : ''}>
                          {["Apartment", "Villa", "Townhouse", "Penthouse", "Studio"].map(type => (
                            <SelectItem key={type} value={type} className={darkMode ? 'text-white hover:bg-[#3B4A54]' : ''}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className={textMuted}>Notes</Label>
                    <Textarea
                      data-testid="lead-notes-input"
                      placeholder="e.g., Looking for 3BR, budget 4M AED, viewing tomorrow"
                      value={newLead.notes}
                      onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                      rows={2}
                      className={darkMode ? 'bg-[#2A3942] border-[#3B4A54] text-white' : ''}
                    />
                  </div>
                  <Button 
                    data-testid="submit-lead-btn"
                    onClick={handleCreateLead} 
                    disabled={creating}
                    className="w-full bg-[#00A884] hover:bg-[#00A884]/90 text-white rounded-full"
                  >
                    {creating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scoring with AI...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />Add & Score Lead</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto pb-24">
        {/* Urgent Banner */}
        {urgentCount > 0 && (
          <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl text-white animate-pulse-slow">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <span className="font-semibold">{urgentCount} lead{urgentCount > 1 ? 's' : ''} need your attention in the next 2 hours</span>
            </div>
          </div>
        )}

        {/* Maya Activity Strip */}
        {voiceStats && (voiceStats.total_calls > 0 || mayaCalledToday > 0) && (
          <Link to="/voice-ai" className="block mx-4 mt-3">
            <div className={`p-3 ${darkMode ? 'bg-[#1F2C34] border-[#2A3942]' : 'bg-white border-gray-200'} border rounded-xl flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-purple-500" />
                </div>
                <span className={`text-sm ${textMuted}`}>
                  <span className="font-medium text-purple-500">Maya</span> called {mayaCalledToday} leads today • {mayaQualified} qualified • {mayaFollowUp} follow-up needed
                </span>
              </div>
              <ChevronRight className={`w-4 h-4 ${textMuted}`} />
            </div>
          </Link>
        )}

        {/* Filter Pills */}
        <div className="px-4 mt-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-2">
            {[
              { id: 'all', label: 'All', count: processedLeads.length },
              { id: 'urgent', label: '🔥 Urgent', count: processedLeads.filter(l => l.priority.level === 'P1').length },
              { id: 'maya', label: '🤖 Maya Called', count: processedLeads.filter(l => l.maya_call_status === 'completed').length },
              { id: 'viewing', label: '📅 Viewing Today', count: processedLeads.filter(l => l.maya_bant?.timeline?.toLowerCase().includes('today')).length },
              { id: 'international', label: '🌍 International', count: processedLeads.filter(l => !['English', 'Arabic'].includes(l.language_preference)).length },
              { id: 'highbudget', label: '💰 4M+ Budget', count: processedLeads.filter(l => l.estimated_deal_value >= 4000000).length },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                data-testid={`filter-${filter.id}`}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === filter.id
                    ? 'bg-[#00A884] text-white'
                    : darkMode 
                      ? 'bg-[#2A3942] text-gray-300 hover:bg-[#3B4A54]' 
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {filter.label} {filter.count > 0 && <span className="ml-1 opacity-75">({filter.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Lead Cards */}
        <div className="mt-4 space-y-3 px-4">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className={`${cardBg} rounded-2xl p-4 animate-pulse`}>
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-300" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredLeads.length === 0 ? (
            <div className={`${cardBg} rounded-2xl p-8 text-center`}>
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <p className={`font-medium ${textColor}`}>No leads in this view</p>
              <p className={`text-sm ${textMuted} mt-1`}>Try a different filter or add a new lead</p>
            </div>
          ) : (
            filteredLeads.map((lead, index) => (
              <div
                key={lead.id}
                data-testid={`lead-card-${lead.id}`}
                className={`${cardBg} rounded-2xl overflow-hidden border-l-4 ${lead.priority.borderColor} shadow-sm hover:shadow-md transition-all duration-300 animate-slide-up`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Card Header */}
                <div className="p-4 pb-2">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                      {getInitials(lead.name)}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold ${lead.priority.textColor}`}>{lead.priority.icon} {lead.priority.level}</span>
                        <span className="text-gray-400">•</span>
                        <Link to={`/leads/${lead.id}`} className={`font-semibold ${textColor} hover:underline truncate`}>
                          {lead.name}
                        </Link>
                        <span className={`text-xs ${textMuted} ml-auto flex-shrink-0`}>{lead.timeAgo}</span>
                      </div>
                      
                      {/* Last Message Preview */}
                      <div className={`mt-1 text-sm ${textMuted} line-clamp-2`}>
                        {lead.maya_call_status === 'completed' ? (
                          <span className="flex items-center gap-1">
                            <Bot className="w-3 h-3 text-purple-500" />
                            <span className="text-purple-500 font-medium">Maya Voice Call Completed</span>
                          </span>
                        ) : (
                          <span className="flex items-start gap-1">
                            <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            "{getLastMessage(lead)}"
                          </span>
                        )}
                      </div>
                      
                      {/* Score + Criteria Badges */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-sm font-bold ${lead.score >= 8 ? 'text-red-500' : lead.score >= 6 ? 'text-amber-500' : 'text-blue-500'}`}>
                          Score: {lead.score * 10}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs">
                          Budget {hasCriteria(lead, 'budget') ? '✅' : '⏳'}
                        </span>
                        <span className="text-xs">
                          Area {hasCriteria(lead, 'area') ? '✅' : '⏳'}
                        </span>
                        {hasCriteria(lead, 'timeline') && (
                          <span className="text-xs">
                            Timeline ✅
                          </span>
                        )}
                      </div>
                      
                      {/* WHY NOW - Most Important */}
                      <div className={`mt-2 py-1.5 px-3 rounded-lg ${darkMode ? 'bg-[#2A3942]' : 'bg-amber-50'} inline-block`}>
                        <span className={`text-xs font-bold ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                          WHY NOW: {lead.whyNow}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className={`px-4 py-3 flex gap-2 border-t ${borderColor} overflow-x-auto`}>
                  {lead.maya_call_status === 'completed' && lead.maya_recording_url ? (
                    <>
                      <a href={lead.maya_recording_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`w-full rounded-full ${darkMode ? 'border-purple-500/50 text-purple-400 hover:bg-purple-500/20' : 'border-purple-200 text-purple-600 hover:bg-purple-50'}`}
                          data-testid={`listen-${lead.id}`}
                        >
                          <Headphones className="w-4 h-4 mr-1" />
                          Listen
                        </Button>
                      </a>
                      <Link to={`/leads/${lead.id}`} className="flex-1 min-w-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`w-full rounded-full ${darkMode ? 'border-blue-500/50 text-blue-400 hover:bg-blue-500/20' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                          data-testid={`send-info-${lead.id}`}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Send Info
                        </Button>
                      </Link>
                      <a href={`https://wa.me/${lead.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`w-full rounded-full ${darkMode ? 'border-green-500/50 text-green-400 hover:bg-green-500/20' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                          data-testid={`reply-${lead.id}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Reply
                        </Button>
                      </a>
                    </>
                  ) : (
                    <>
                      <a href={`tel:${lead.phone}`} className="flex-1 min-w-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`w-full rounded-full ${darkMode ? 'border-green-500/50 text-green-400 hover:bg-green-500/20' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                          data-testid={`call-${lead.id}`}
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                      </a>
                      <a href={`https://wa.me/${lead.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`w-full rounded-full ${darkMode ? 'border-[#25D366]/50 text-[#25D366] hover:bg-[#25D366]/20' : 'border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10'}`}
                          data-testid={`whatsapp-${lead.id}`}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          WhatsApp
                        </Button>
                      </a>
                      <Link to={`/leads/${lead.id}`} className="flex-1 min-w-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className={`w-full rounded-full ${darkMode ? 'border-amber-500/50 text-amber-400 hover:bg-amber-500/20' : 'border-amber-200 text-amber-600 hover:bg-amber-50'}`}
                          data-testid={`schedule-${lead.id}`}
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Schedule
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.85;
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.4s ease-out forwards;
          opacity: 0;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
