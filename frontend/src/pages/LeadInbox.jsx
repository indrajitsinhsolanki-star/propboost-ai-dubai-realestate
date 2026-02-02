import { useState, useEffect } from "react";
import { api } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  Loader2
} from "lucide-react";

export default function LeadInbox() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rescoring, setRescoring] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    email: "",
    language_preference: "English",
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
      const response = await api.createLead(newLead);
      setLeads([response.data, ...leads]);
      setShowAddDialog(false);
      setNewLead({
        name: "",
        phone: "",
        email: "",
        language_preference: "English",
        property_interests: { location: "", bedrooms: "", budget: "", property_type: "" },
        notes: ""
      });
      toast.success(`Lead created with score: ${response.data.score}/10`);
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

  const filteredLeads = leads.filter(lead => {
    if (activeTab === "hot") return lead.score >= 8;
    if (activeTab === "warm") return lead.score >= 6 && lead.score < 8;
    if (activeTab === "cold") return lead.score < 6;
    return true;
  });

  const hotCount = leads.filter(l => l.score >= 8).length;
  const warmCount = leads.filter(l => l.score >= 6 && l.score < 8).length;
  const coldCount = leads.filter(l => l.score < 6).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Lead Inbox
          </h1>
          <p className="text-gray-500 mt-1">AI-scored leads ready for action</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    data-testid="lead-name-input"
                    placeholder="Full name"
                    value={newLead.name}
                    onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    data-testid="lead-phone-input"
                    placeholder="+971 XX XXX XXXX"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    data-testid="lead-email-input"
                    type="email"
                    placeholder="email@example.com"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select 
                    value={newLead.language_preference}
                    onValueChange={(val) => setNewLead({...newLead, language_preference: val})}
                  >
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

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Property Interests</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      data-testid="lead-location-input"
                      placeholder="e.g., Downtown Dubai"
                      value={newLead.property_interests.location}
                      onChange={(e) => setNewLead({
                        ...newLead, 
                        property_interests: {...newLead.property_interests, location: e.target.value}
                      })}
                    />
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
            value="all" 
            data-testid="tab-all-leads"
            className="rounded-full data-[state=active]:bg-[#001F3F] data-[state=active]:text-white px-6"
          >
            All ({leads.length})
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
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card className="bg-white border border-gray-100">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">No leads found</h3>
                <p className="text-gray-500 mt-1">Add your first lead to get started</p>
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
                  } shadow-sm card-hover animate-fade-in`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Lead Info */}
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${getScoreColor(lead.score)} border`}>
                          {getScoreIcon(lead.score)}
                          <span className="text-lg font-bold">{lead.score}</span>
                        </div>
                        <div className="flex-1">
                          <Link 
                            to={`/leads/${lead.id}`}
                            className="text-lg font-semibold text-[#0F172A] hover:text-[#D4AF37] transition-colors"
                          >
                            {lead.name}
                          </Link>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {lead.phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {lead.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3" /> {lead.language_preference}
                            </span>
                          </div>
                          {lead.ai_briefing && (
                            <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                              {lead.ai_briefing}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {lead.stage}
                        </Badge>
                        <Button
                          variant="outline"
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
                        <Link to={`/leads/${lead.id}`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            data-testid={`view-lead-${lead.id}`}
                            className="rounded-full"
                          >
                            View <ChevronRight className="w-4 h-4 ml-1" />
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

function Users({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
