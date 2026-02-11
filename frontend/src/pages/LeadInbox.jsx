import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Flame, 
  ThermometerSun, 
  Snowflake, 
  Phone, 
  Mail, 
  Globe,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Loader2,
  Users,
  DollarSign,
  Building,
  MessageSquare,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Shield,
  Zap
} from "lucide-react";

const LEAD_SOURCES = ["Property Finder", "Bayut", "Instagram", "WhatsApp", "Walk-in"];

// Dubai market average prices by area/type for budget flagging
const MARKET_AVERAGES = {
  "Palm Jumeirah": { Villa: 15000000, Apartment: 3500000, Penthouse: 25000000 },
  "Downtown Dubai": { Villa: 12000000, Apartment: 2500000, Penthouse: 15000000 },
  "Dubai Hills": { Villa: 8000000, Apartment: 2000000, Townhouse: 4000000 },
  "Dubai Marina": { Villa: 10000000, Apartment: 2000000, Penthouse: 8000000 },
  "default": { Villa: 5000000, Apartment: 1500000, Penthouse: 8000000, Townhouse: 3000000 }
};

export default function LeadInbox() {
  const { api } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rescoring, setRescoring] = useState(null);
  const [activeTab, setActiveTab] = useState("action");
  const [whatsappDialog, setWhatsappDialog] = useState(null);
  
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

  const handleRescore = async (leadId) => {
    setRescoring(leadId);
    try {
      const response = await api.rescoreLead(leadId);
      setLeads(leads.map(l => l.id === leadId ? response.data : l));
      toast.success(`Lead rescored: ${response.data.score}/10`);
    } catch (error) {
      toast.error("Failed to rescore lead");
    } finally {
      setRescoring(null);
    }
  };

  // Check if budget is below market average
  const isBudgetBelowMarket = (lead) => {
    const location = lead.property_interests?.location || "default";
    const propertyType = lead.property_interests?.property_type || "Apartment";
    const budget = lead.estimated_deal_value || 0;
    
    const marketPrices = MARKET_AVERAGES[location] || MARKET_AVERAGES["default"];
    const avgPrice = marketPrices[propertyType] || 2000000;
    
    return budget > 0 && budget < avgPrice * 0.7; // Flag if 30%+ below market
  };

  // Get confidence score styling
  const getConfidenceStyle = (score) => {
    if (score >= 70) return "bg-green-500 text-white";
    if (score >= 40) return "bg-yellow-500 text-white";
    return "bg-red-500 text-white";
  };

  // Generate WhatsApp handoff message
  const generateWhatsAppMessage = (lead) => {
    const bant = lead.maya_bant || {};
    const message = `🏠 *PropBoost AI - Lead Qualified*

👤 *Lead:* ${lead.name}
📞 *Phone:* ${lead.phone}
📧 *Email:* ${lead.email}

💰 *Budget:* ${bant.budget || lead.property_interests?.budget || "Not confirmed"}
🏢 *Need:* ${bant.need || lead.property_interests?.property_type || "Not specified"}
⏰ *Timeline:* ${bant.timeline || "Not confirmed"}
📍 *Location:* ${bant.location || lead.property_interests?.location || "TBD"}

🎯 *Interest Level:* ${bant.interest_level || "Unknown"}
📊 *AI Confidence:* ${lead.maya_confidence_score || 0}%

📝 *Call Summary:*
${lead.maya_call_summary || "No call summary available"}

🔗 *View Full Profile:* ${window.location.origin}/leads/${lead.id}`;
    
    return encodeURIComponent(message);
  };

  const copyWhatsAppMessage = (lead) => {
    const bant = lead.maya_bant || {};
    const message = `🏠 PropBoost AI - Lead Qualified

👤 Lead: ${lead.name}
📞 Phone: ${lead.phone}
📧 Email: ${lead.email}

💰 Budget: ${bant.budget || lead.property_interests?.budget || "Not confirmed"}
🏢 Need: ${bant.need || lead.property_interests?.property_type || "Not specified"}
⏰ Timeline: ${bant.timeline || "Not confirmed"}
📍 Location: ${bant.location || lead.property_interests?.location || "TBD"}

🎯 Interest Level: ${bant.interest_level || "Unknown"}
📊 AI Confidence: ${lead.maya_confidence_score || 0}%

📝 Call Summary:
${lead.maya_call_summary || "No call summary available"}

🔗 View Full Profile: ${window.location.origin}/leads/${lead.id}`;
    
    navigator.clipboard.writeText(message);
    toast.success("Message copied! Paste in WhatsApp");
    setWhatsappDialog(null);
  };

  const getScoreColor = (score) => {
    if (score >= 8) return "text-red-500 bg-red-50 border-red-200";
    if (score >= 6) return "text-orange-500 bg-orange-50 border-orange-200";
    return "text-blue-500 bg-blue-50 border-blue-200";
  };

  const getScoreIcon = (score) => {
    if (score >= 8) return <Flame className="w-4 h-4" />;
    if (score >= 6) return <ThermometerSun className="w-4 h-4" />;
    return <Snowflake className="w-4 h-4" />;
  };

  const getSourceBadgeColor = (source) => {
    switch(source) {
      case "Property Finder": return "bg-blue-100 text-blue-700";
      case "Bayut": return "bg-purple-100 text-purple-700";
      case "Instagram": return "bg-pink-100 text-pink-700";
      case "WhatsApp": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  // Filter leads based on tab
  const getFilteredLeads = () => {
    switch(activeTab) {
      case "action":
        // Action queue: Hot leads with Maya data OR leads needing attention
        return leads
          .filter(l => l.score >= 7 || l.maya_call_status === "completed")
          .sort((a, b) => (b.maya_confidence_score || 0) - (a.maya_confidence_score || 0));
      case "hot":
        return leads.filter(l => l.score >= 8);
      case "warm":
        return leads.filter(l => l.score >= 6 && l.score < 8);
      case "cold":
        return leads.filter(l => l.score < 6);
      default:
        return leads;
    }
  };

  const filteredLeads = getFilteredLeads();
  const actionCount = leads.filter(l => l.score >= 7 || l.maya_call_status === "completed").length;
  const hotCount = leads.filter(l => l.score >= 8).length;
  const warmCount = leads.filter(l => l.score >= 6 && l.score < 8).length;
  const coldCount = leads.filter(l => l.score < 6).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Action Feed
          </h1>
          <p className="text-gray-500 mt-1">High-velocity lead queue powered by Maya AI</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button 
              data-testid="add-lead-btn"
              className="bg-[#001F3F] hover:bg-[#001F3F]/90 text-white rounded-full px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold" style={{ fontFamily: 'Playfair Display, serif' }}>
                Add New Lead
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    data-testid="lead-name-input"
                    placeholder="Ahmed Al Rashid"
                    value={newLead.name}
                    onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    data-testid="lead-phone-input"
                    placeholder="+971 50 123 4567"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    data-testid="lead-email-input"
                    type="email"
                    placeholder="ahmed@example.com"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={newLead.language_preference} onValueChange={(val) => setNewLead({...newLead, language_preference: val})}>
                    <SelectTrigger data-testid="lead-language-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Arabic">Arabic</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="Russian">Russian</SelectItem>
                      <SelectItem value="Mandarin">Mandarin</SelectItem>
                      <SelectItem value="French">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lead Source & Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Select value={newLead.lead_source} onValueChange={(val) => setNewLead({...newLead, lead_source: val})}>
                    <SelectTrigger data-testid="lead-source-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SOURCES.map(src => (
                        <SelectItem key={src} value={src}>{src}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estimated Deal Value (AED)</Label>
                  <Input
                    data-testid="lead-deal-value-input"
                    type="number"
                    placeholder="5000000"
                    value={newLead.estimated_deal_value}
                    onChange={(e) => setNewLead({...newLead, estimated_deal_value: e.target.value})}
                  />
                </div>
              </div>

              {/* Property Interests */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Property Interests</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select 
                      value={newLead.property_interests.location}
                      onValueChange={(val) => setNewLead({
                        ...newLead, 
                        property_interests: {...newLead.property_interests, location: val}
                      })}
                    >
                      <SelectTrigger data-testid="lead-location-select">
                        <SelectValue placeholder="Select area" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Palm Jumeirah">Palm Jumeirah</SelectItem>
                        <SelectItem value="Downtown Dubai">Downtown Dubai</SelectItem>
                        <SelectItem value="Dubai Hills">Dubai Hills</SelectItem>
                        <SelectItem value="Dubai Marina">Dubai Marina</SelectItem>
                        <SelectItem value="JBR">JBR</SelectItem>
                        <SelectItem value="Business Bay">Business Bay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bedrooms</Label>
                    <Input
                      data-testid="lead-bedrooms-input"
                      placeholder="e.g., 2-3"
                      value={newLead.property_interests.bedrooms}
                      onChange={(e) => setNewLead({
                        ...newLead, 
                        property_interests: {...newLead.property_interests, bedrooms: e.target.value}
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Budget (AED)</Label>
                    <Input
                      data-testid="lead-budget-input"
                      placeholder="e.g., 2,000,000"
                      value={newLead.property_interests.budget}
                      onChange={(e) => setNewLead({
                        ...newLead, 
                        property_interests: {...newLead.property_interests, budget: e.target.value}
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Property Type</Label>
                    <Select 
                      value={newLead.property_interests.property_type}
                      onValueChange={(val) => setNewLead({
                        ...newLead, 
                        property_interests: {...newLead.property_interests, property_type: val}
                      })}
                    >
                      <SelectTrigger data-testid="lead-property-type-select">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Apartment">Apartment</SelectItem>
                        <SelectItem value="Villa">Villa</SelectItem>
                        <SelectItem value="Townhouse">Townhouse</SelectItem>
                        <SelectItem value="Penthouse">Penthouse</SelectItem>
                        <SelectItem value="Studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  data-testid="lead-notes-input"
                  placeholder="Additional notes about the lead..."
                  value={newLead.notes}
                  onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <Button 
                data-testid="submit-lead-btn"
                onClick={handleCreateLead} 
                disabled={creating}
                className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white rounded-full"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Scoring with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Score Lead
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-gray-200 p-1 rounded-full">
          <TabsTrigger 
            value="action" 
            data-testid="tab-action-queue"
            className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white px-6"
          >
            <Zap className="w-4 h-4 mr-1" /> Action Queue ({actionCount})
          </TabsTrigger>
          <TabsTrigger 
            value="hot"
            data-testid="tab-hot-leads"
            className="rounded-full data-[state=active]:bg-red-500 data-[state=active]:text-white px-6"
          >
            <Flame className="w-4 h-4 mr-1" /> Hot ({hotCount})
          </TabsTrigger>
          <TabsTrigger 
            value="warm"
            data-testid="tab-warm-leads"
            className="rounded-full data-[state=active]:bg-orange-400 data-[state=active]:text-white px-6"
          >
            <ThermometerSun className="w-4 h-4 mr-1" /> Warm ({warmCount})
          </TabsTrigger>
          <TabsTrigger 
            value="cold"
            data-testid="tab-cold-leads"
            className="rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white px-6"
          >
            <Snowflake className="w-4 h-4 mr-1" /> Cold ({coldCount})
          </TabsTrigger>
          <TabsTrigger 
            value="all"
            data-testid="tab-all-leads"
            className="rounded-full data-[state=active]:bg-gray-700 data-[state=active]:text-white px-6"
          >
            All ({leads.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card className="bg-white border border-gray-100">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">No leads in action queue</h3>
                <p className="text-gray-500 mt-1">Add hot leads or wait for Maya to qualify them</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredLeads.map((lead, index) => (
                <Card 
                  key={lead.id} 
                  className={`bg-white border-l-4 ${
                    lead.score >= 8 ? 'border-l-red-500' : 
                    lead.score >= 6 ? 'border-l-orange-400' : 'border-l-blue-500'
                  } shadow-sm hover:shadow-md transition-shadow animate-fade-in`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  data-testid={`lead-card-${lead.id}`}
                >
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col gap-4">
                      {/* Top Row: Score + Info + Confidence */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          {/* Score Badge */}
                          <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${getScoreColor(lead.score)} border`}>
                            {getScoreIcon(lead.score)}
                            <span className="text-lg font-bold">{lead.score}</span>
                          </div>
                          
                          {/* Lead Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link 
                                to={`/leads/${lead.id}`}
                                className="text-lg font-semibold text-[#0F172A] hover:text-[#D4AF37] transition-colors"
                              >
                                {lead.name}
                              </Link>
                              <Badge className={`text-xs ${getSourceBadgeColor(lead.lead_source)}`}>
                                {lead.lead_source}
                              </Badge>
                              
                              {/* Confidence Score */}
                              {lead.maya_confidence_score > 0 && (
                                <Badge className={`text-xs ${getConfidenceStyle(lead.maya_confidence_score)}`}>
                                  {lead.maya_confidence_score}% Confident
                                </Badge>
                              )}
                              
                              {/* Budget Flag */}
                              {isBudgetBelowMarket(lead) && (
                                <Badge className="text-xs bg-red-100 text-red-700 border border-red-200">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Budget Below Market
                                </Badge>
                              )}
                              
                              {/* Maya Status */}
                              {lead.maya_call_status === "completed" && (
                                <Badge className="text-xs bg-green-100 text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Maya Qualified
                                </Badge>
                              )}
                              
                              {/* Compliance Status */}
                              {lead.compliance_status === "pending" && (
                                <Badge className="text-xs bg-yellow-100 text-yellow-700">
                                  <Shield className="w-3 h-3 mr-1" />
                                  RERA Pending
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {lead.phone}
                              </span>
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" /> {lead.language_preference}
                              </span>
                              {lead.estimated_deal_value > 0 && (
                                <span className="flex items-center gap-1 text-[#D4AF37] font-medium">
                                  <DollarSign className="w-3 h-3" /> {(lead.estimated_deal_value / 1000000).toFixed(1)}M AED
                                </span>
                              )}
                              {lead.maya_bant?.timeline && (
                                <span className="flex items-center gap-1 text-purple-600">
                                  <Calendar className="w-3 h-3" /> {lead.maya_bant.timeline}
                                </span>
                              )}
                            </div>
                            
                            {/* BANT Quick View */}
                            {lead.maya_bant && Object.keys(lead.maya_bant).length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {lead.maya_bant.budget && (
                                  <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">
                                    💰 {lead.maya_bant.budget}
                                  </span>
                                )}
                                {lead.maya_bant.location && (
                                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                                    📍 {lead.maya_bant.location}
                                  </span>
                                )}
                                {lead.maya_bant.interest_level && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    lead.maya_bant.interest_level === 'high' ? 'bg-green-50 text-green-700' :
                                    lead.maya_bant.interest_level === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                                    'bg-gray-50 text-gray-700'
                                  }`}>
                                    🎯 {lead.maya_bant.interest_level} interest
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                        {/* Open Call Summary */}
                        <Link to={`/leads/${lead.id}`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            data-testid={`open-summary-${lead.id}`}
                            className="rounded-full text-purple-600 border-purple-200 hover:bg-purple-50"
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            {lead.maya_call_summary ? "View Summary" : "View Lead"}
                          </Button>
                        </Link>
                        
                        {/* WhatsApp Handoff */}
                        <Dialog open={whatsappDialog === lead.id} onOpenChange={(open) => setWhatsappDialog(open ? lead.id : null)}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              data-testid={`whatsapp-${lead.id}`}
                              className="rounded-full text-green-600 border-green-200 hover:bg-green-50"
                            >
                              <MessageSquare className="w-4 h-4 mr-1" />
                              WhatsApp Handoff
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-green-600" />
                                Send to WhatsApp
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                              <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {`🏠 PropBoost AI - Lead Qualified

👤 Lead: ${lead.name}
📞 Phone: ${lead.phone}

💰 Budget: ${lead.maya_bant?.budget || lead.property_interests?.budget || "Not confirmed"}
🏢 Need: ${lead.maya_bant?.need || lead.property_interests?.property_type || "Not specified"}
⏰ Timeline: ${lead.maya_bant?.timeline || "Not confirmed"}

🎯 Interest: ${lead.maya_bant?.interest_level || "Unknown"}
📊 AI Confidence: ${lead.maya_confidence_score || 0}%

📝 Summary: ${lead.maya_call_summary || "No summary available"}`}
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => copyWhatsAppMessage(lead)}
                                  className="flex-1 bg-green-600 hover:bg-green-700 rounded-full"
                                  data-testid={`copy-whatsapp-${lead.id}`}
                                >
                                  Copy Message
                                </Button>
                                <a 
                                  href={`https://wa.me/?text=${generateWhatsAppMessage(lead)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1"
                                >
                                  <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] rounded-full">
                                    Open WhatsApp
                                  </Button>
                                </a>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {/* Book Viewing */}
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid={`book-viewing-${lead.id}`}
                          className="rounded-full text-[#D4AF37] border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                          onClick={() => toast.info("Viewing scheduler coming soon!")}
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Book Viewing
                        </Button>
                        
                        {/* Rescore */}
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`rescore-lead-${lead.id}`}
                          onClick={() => handleRescore(lead.id)}
                          disabled={rescoring === lead.id}
                          className="rounded-full"
                        >
                          {rescoring === lead.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        
                        {/* View Full Profile */}
                        <Link to={`/leads/${lead.id}`} className="ml-auto">
                          <Button 
                            variant="default" 
                            size="sm"
                            data-testid={`view-lead-${lead.id}`}
                            className="rounded-full bg-[#001F3F] hover:bg-[#001F3F]/90"
                          >
                            Full Profile <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
