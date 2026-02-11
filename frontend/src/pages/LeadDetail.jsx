import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Globe,
  MapPin,
  Home,
  DollarSign,
  RefreshCw,
  MessageSquare,
  Send,
  Copy,
  CheckCircle,
  Loader2,
  Flame,
  ThermometerSun,
  Snowflake,
  Clock,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  Mic,
  Play,
  FileText,
  Target,
  Users,
  Shield,
  ExternalLink
} from "lucide-react";

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);
  const [messages, setMessages] = useState([]);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [messageType, setMessageType] = useState("reminder");
  const [messageLanguage, setMessageLanguage] = useState("English");
  const [triggeringCall, setTriggeringCall] = useState(false);

  useEffect(() => {
    loadLead();
    loadMessages();
  }, [id]);

  const loadLead = async () => {
    try {
      const response = await api.getLead(id);
      setLead(response.data);
    } catch (error) {
      toast.error("Failed to load lead");
      navigate("/leads");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await api.getLeadMessages(id);
      setMessages(response.data);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const handleRescore = async () => {
    setRescoring(true);
    try {
      const response = await api.rescoreLead(id);
      setLead(response.data);
      toast.success(`Lead rescored: ${response.data.score}/10`);
    } catch (error) {
      toast.error("Failed to rescore lead");
    } finally {
      setRescoring(false);
    }
  };

  const handleTriggerMayaCall = async () => {
    setTriggeringCall(true);
    try {
      const response = await api.triggerVoiceCall(id, lead.language_preference || "English");
      toast.success(`Maya call ${response.data.status}: ${response.data.message}`);
      // Reload lead to get updated call status
      await loadLead();
    } catch (error) {
      toast.error("Failed to trigger Maya call");
    } finally {
      setTriggeringCall(false);
    }
  };

  const handleGenerateMessage = async () => {
    setGeneratingMessage(true);
    try {
      const response = await api.generateWhatsApp(id, messageType, messageLanguage);
      setMessages([response.data, ...messages]);
      toast.success("Message generated! Review and approve before sending.");
    } catch (error) {
      toast.error("Failed to generate message");
    } finally {
      setGeneratingMessage(false);
    }
  };

  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard!");
  };

  const handleApproveMessage = async (messageId) => {
    try {
      await api.approveWhatsApp(messageId);
      setMessages(messages.map(m => m.id === messageId ? {...m, status: "approved"} : m));
      toast.success("Message approved! Click 'Send' to deliver.");
    } catch (error) {
      toast.error("Failed to approve message");
    }
  };

  const handleSendMessage = async (messageId) => {
    try {
      const response = await api.sendWhatsApp(messageId);
      setMessages(messages.map(m => m.id === messageId ? {...m, status: "sent"} : m));
      toast.success(response.data.message || "Message sent!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send message");
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return "text-red-500 bg-red-50";
    if (score >= 6) return "text-orange-500 bg-orange-50";
    return "text-blue-500 bg-blue-50";
  };

  const getScoreIcon = (score) => {
    if (score >= 8) return <Flame className="w-5 h-5" />;
    if (score >= 6) return <ThermometerSun className="w-5 h-5" />;
    return <Snowflake className="w-5 h-5" />;
  };

  const getMayaCallStatusBadge = (status) => {
    switch(status) {
      case "initiated":
        return <Badge className="bg-blue-500"><PhoneForwarded className="w-3 h-3 mr-1" />Call Initiated</Badge>;
      case "simulated":
        return <Badge className="bg-purple-500"><PhoneCall className="w-3 h-3 mr-1" />Simulated (Demo)</Badge>;
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Call Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-500"><PhoneOff className="w-3 h-3 mr-1" />Call Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-32"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!lead) return null;

  const interests = lead.property_interests || {};

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          data-testid="back-btn"
          onClick={() => navigate("/leads")}
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            {lead.name}
          </h1>
          <p className="text-gray-500">Lead Details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Score Card */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${getScoreColor(lead.score)}`}>
                    {getScoreIcon(lead.score)}
                    <span className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
                      {lead.score}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">AI Lead Score</h3>
                    <p className="text-sm text-gray-500 mt-1">{lead.score_reasoning || "Scored by AI"}</p>
                  </div>
                </div>
                <Button 
                  onClick={handleRescore}
                  disabled={rescoring}
                  data-testid="rescore-btn"
                  className="bg-[#001F3F] hover:bg-[#001F3F]/90 rounded-full"
                >
                  {rescoring ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Rescore
                </Button>
              </div>
              
              {lead.ai_briefing && (
                <div className="mt-4 p-4 bg-[#001F3F]/5 rounded-xl">
                  <h4 className="font-medium text-[#001F3F] mb-2">AI Briefing</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.ai_briefing}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voice AI Maya Status Card */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between" style={{ fontFamily: 'Playfair Display, serif' }}>
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-purple-500" />
                  Voice AI &quot;Maya&quot; Activity
                </div>
                {lead.maya_confidence_score > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">AI Confidence:</span>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                      lead.maya_confidence_score >= 70 ? 'bg-green-100 text-green-700' :
                      lead.maya_confidence_score >= 40 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {lead.maya_confidence_score}%
                    </div>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
                    <PhoneCall className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Call Status:</span>
                      {getMayaCallStatusBadge(lead.maya_call_status)}
                    </div>
                    {lead.maya_call_id && (
                      <p className="text-xs text-gray-500 mt-1">Call ID: {lead.maya_call_id}</p>
                    )}
                    {!lead.maya_call_status && lead.score > 7 && (
                      <p className="text-sm text-purple-600 mt-1">Hot lead eligible for Maya outreach</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {lead.maya_recording_url && (
                    <a 
                      href={lead.maya_recording_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 text-purple-600 rounded-full text-sm hover:bg-purple-50"
                      data-testid="maya-recording-link"
                    >
                      <Play className="w-4 h-4" /> Listen to Recording
                    </a>
                  )}
                  <Button
                    onClick={handleTriggerMayaCall}
                    disabled={triggeringCall}
                    data-testid="trigger-maya-call-btn"
                    className="bg-purple-600 hover:bg-purple-700 rounded-full"
                  >
                    {triggeringCall ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <PhoneCall className="w-4 h-4 mr-2" />
                    )}
                    {lead.maya_call_status ? "Retry Call" : "Trigger Maya Call"}
                  </Button>
                </div>
              </div>

              {/* BANT Summary Section */}
              {(lead.maya_call_summary || lead.maya_bant) && (
                <div className="space-y-4">
                  {/* Call Summary */}
                  {lead.maya_call_summary && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                      <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Call Summary
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{lead.maya_call_summary}</p>
                    </div>
                  )}

                  {/* BANT Qualification Grid */}
                  {lead.maya_bant && Object.keys(lead.maya_bant).length > 0 && (
                    <div className="p-4 bg-white border border-gray-200 rounded-xl">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-[#D4AF37]" />
                        BANT Qualification
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Budget */}
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-1 text-green-700 mb-1">
                            <DollarSign className="w-3 h-3" />
                            <span className="text-xs font-medium">Budget</span>
                          </div>
                          <p className="text-sm font-semibold text-green-800">
                            {lead.maya_bant.budget || "Not confirmed"}
                          </p>
                        </div>
                        
                        {/* Authority */}
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-1 text-blue-700 mb-1">
                            <Users className="w-3 h-3" />
                            <span className="text-xs font-medium">Authority</span>
                          </div>
                          <p className="text-sm font-semibold text-blue-800 capitalize">
                            {lead.maya_bant.authority || "Unknown"}
                          </p>
                        </div>
                        
                        {/* Need */}
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <div className="flex items-center gap-1 text-orange-700 mb-1">
                            <Home className="w-3 h-3" />
                            <span className="text-xs font-medium">Need</span>
                          </div>
                          <p className="text-sm font-semibold text-orange-800 truncate">
                            {lead.maya_bant.need || lead.maya_bant.property_type || "Not specified"}
                          </p>
                        </div>
                        
                        {/* Timeline */}
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-1 text-purple-700 mb-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs font-medium">Timeline</span>
                          </div>
                          <p className="text-sm font-semibold text-purple-800">
                            {lead.maya_bant.timeline || "Not confirmed"}
                          </p>
                        </div>
                      </div>

                      {/* Interest Level & Location */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lead.maya_bant.interest_level && (
                          <Badge className={`${
                            lead.maya_bant.interest_level === 'high' ? 'bg-green-500' :
                            lead.maya_bant.interest_level === 'medium' ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}>
                            Interest: {lead.maya_bant.interest_level}
                          </Badge>
                        )}
                        {lead.maya_bant.location && (
                          <Badge variant="outline" className="border-[#D4AF37] text-[#D4AF37]">
                            <MapPin className="w-3 h-3 mr-1" />
                            {lead.maya_bant.location}
                          </Badge>
                        )}
                      </div>

                      {/* Next Steps */}
                      {lead.maya_bant.next_steps && (
                        <div className="mt-3 p-3 bg-[#001F3F]/5 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Next Steps</p>
                          <p className="text-sm text-[#001F3F] font-medium">{lead.maya_bant.next_steps}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#001F3F] flex items-center justify-center">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{lead.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#001F3F] flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{lead.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center">
                    <Globe className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Language</p>
                    <p className="font-medium">{lead.language_preference}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Stage</p>
                    <Badge className="mt-1 capitalize">{lead.stage}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Interests */}
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Property Interests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {interests.location && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">Location</span>
                    </div>
                    <p className="font-medium">{interests.location}</p>
                  </div>
                )}
                {interests.bedrooms && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Home className="w-4 h-4" />
                      <span className="text-sm">Bedrooms</span>
                    </div>
                    <p className="font-medium">{interests.bedrooms}</p>
                  </div>
                )}
                {interests.budget && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">Budget</span>
                    </div>
                    <p className="font-medium">{interests.budget} AED</p>
                  </div>
                )}
                {interests.property_type && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Home className="w-4 h-4" />
                      <span className="text-sm">Type</span>
                    </div>
                    <p className="font-medium">{interests.property_type}</p>
                  </div>
                )}
              </div>
              {lead.notes && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* WhatsApp Messages */}
        <div className="space-y-6">
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                <MessageSquare className="w-5 h-5 text-green-500" />
                WhatsApp Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Generate Message */}
              <div className="p-4 bg-green-50 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={messageType} onValueChange={setMessageType}>
                    <SelectTrigger data-testid="message-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reminder">24h Reminder</SelectItem>
                      <SelectItem value="confirmation">2h Confirmation</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="nurture">Nurture</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={messageLanguage} onValueChange={setMessageLanguage}>
                    <SelectTrigger data-testid="message-language-select">
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
                <Button 
                  onClick={handleGenerateMessage}
                  disabled={generatingMessage}
                  data-testid="generate-message-btn"
                  className="w-full bg-green-600 hover:bg-green-700 rounded-full"
                >
                  {generatingMessage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Generate Message
                    </>
                  )}
                </Button>
              </div>

              {/* Approval Workflow Notice */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                <strong>Approval Workflow:</strong> Messages must be approved before sending. 
                Click "Approve" then "Send" to deliver via WhatsApp.
              </div>

              {/* Message List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-center text-gray-500 py-4 text-sm">
                    No messages yet. Generate one above.
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {msg.message_type}
                        </Badge>
                        <Badge 
                          className={`text-xs ${
                            msg.status === 'sent' ? 'bg-green-500' : 
                            msg.status === 'approved' ? 'bg-blue-500' : 'bg-gray-500'
                          }`}
                        >
                          {msg.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2" dir={msg.language === 'Arabic' ? 'rtl' : 'ltr'}>
                        {msg.message}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button 
                          size="sm" 
                          variant="outline"
                          data-testid={`copy-message-${msg.id}`}
                          onClick={() => handleCopyMessage(msg.message)}
                          className="rounded-full text-xs"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                        {msg.status === 'draft' && (
                          <Button 
                            size="sm"
                            data-testid={`approve-message-${msg.id}`}
                            onClick={() => handleApproveMessage(msg.id)}
                            className="rounded-full text-xs bg-blue-500 hover:bg-blue-600"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        )}
                        {msg.status === 'approved' && (
                          <Button 
                            size="sm"
                            data-testid={`send-message-${msg.id}`}
                            onClick={() => handleSendMessage(msg.id)}
                            className="rounded-full text-xs bg-green-500 hover:bg-green-600"
                          >
                            <Send className="w-3 h-3 mr-1" /> Send
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
