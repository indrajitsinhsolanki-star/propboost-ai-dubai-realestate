import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
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
  Clock
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

  const handleGenerateMessage = async () => {
    setGeneratingMessage(true);
    try {
      const response = await api.generateWhatsApp(id, messageType, messageLanguage);
      setMessages([response.data, ...messages]);
      toast.success("Message generated!");
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
      toast.success("Message approved!");
    } catch (error) {
      toast.error("Failed to approve message");
    }
  };

  const handleSendMessage = async (messageId) => {
    try {
      await api.sendWhatsApp(messageId);
      setMessages(messages.map(m => m.id === messageId ? {...m, status: "sent"} : m));
      toast.success("Message sent (simulated)!");
    } catch (error) {
      toast.error("Failed to send message");
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
                      <div className="flex gap-2">
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
