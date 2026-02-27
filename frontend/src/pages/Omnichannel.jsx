import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  Play,
  Pause,
  XCircle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Zap,
  ArrowRight,
  Users
} from "lucide-react";

export default function Omnichannel() {
  const { api } = useAuth();
  const [sequences, setSequences] = useState([]);
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedLead, setSelectedLead] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [seqRes, statsRes, leadsRes] = await Promise.all([
        api.getOutreachSequences(),
        api.getOutreachStats(),
        api.getLeads()
      ]);
      setSequences(seqRes.data);
      setStats(statsRes.data);
      setLeads(leadsRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load omnichannel data");
    } finally {
      setLoading(false);
    }
  };

  const createSequence = async () => {
    if (!selectedLead) {
      toast.error("Please select a lead");
      return;
    }
    
    setCreating(true);
    try {
      await api.createOutreachSequence({ lead_id: selectedLead });
      toast.success("Omnichannel sequence started!");
      setSelectedLead("");
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create sequence");
    } finally {
      setCreating(false);
    }
  };

  const executeStep = async (sequenceId, step) => {
    try {
      await api.executeOutreachStep(sequenceId, step);
      toast.success(`Executing ${step} step...`);
      setTimeout(loadData, 2000);
    } catch (error) {
      toast.error("Failed to execute step");
    }
  };

  const pauseSequence = async (sequenceId) => {
    try {
      await api.pauseOutreachSequence(sequenceId);
      toast.success("Sequence paused");
      loadData();
    } catch (error) {
      toast.error("Failed to pause sequence");
    }
  };

  const resumeSequence = async (sequenceId) => {
    try {
      await api.resumeOutreachSequence(sequenceId);
      toast.success("Sequence resumed");
      loadData();
    } catch (error) {
      toast.error("Failed to resume sequence");
    }
  };

  const cancelSequence = async (sequenceId) => {
    try {
      await api.cancelOutreachSequence(sequenceId);
      toast.success("Sequence cancelled");
      loadData();
    } catch (error) {
      toast.error("Failed to cancel sequence");
    }
  };

  const getStepIcon = (step) => {
    switch(step) {
      case "voice": return <Phone className="w-4 h-4" />;
      case "whatsapp": return <MessageSquare className="w-4 h-4" />;
      case "sms": return <MessageSquare className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "active": return "bg-green-100 text-green-700 border-green-200";
      case "completed": return "bg-blue-100 text-blue-700 border-blue-200";
      case "paused": return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "cancelled": return "bg-red-100 text-red-700 border-red-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="omnichannel-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Omnichannel Outreach
          </h1>
          <p className="text-gray-500">Maya's multi-channel lead engagement: Voice → WhatsApp → SMS → Email</p>
        </div>
        <Button 
          onClick={loadData}
          variant="outline"
          className="rounded-full"
          data-testid="refresh-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="total-sequences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Sequences</p>
                <p className="text-3xl font-bold text-[#001F3F]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.total_sequences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="active-sequences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-3xl font-bold text-green-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.active_sequences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Play className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="completed-sequences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-3xl font-bold text-blue-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.completed_sequences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="paused-sequences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Paused</p>
                <p className="text-3xl font-bold text-yellow-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.paused_sequences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Pause className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Sequence */}
      <Card className="bg-gradient-to-r from-[#001F3F] to-[#003366] text-white">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Start New Omnichannel Sequence
          </h3>
          <p className="text-gray-300 mb-4">
            Maya will automatically reach out via: Voice Call (immediate) → WhatsApp (2 min) → SMS (10 min) → Email (1 hour)
          </p>
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={selectedLead}
              onChange={(e) => setSelectedLead(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              data-testid="lead-select"
            >
              <option value="" className="text-gray-900">Select a lead...</option>
              {leads.map(lead => (
                <option key={lead.id} value={lead.id} className="text-gray-900">
                  {lead.name} - {lead.phone} (Score: {lead.score})
                </option>
              ))}
            </select>
            <Button
              onClick={createSequence}
              disabled={creating || !selectedLead}
              className="bg-[#D4AF37] hover:bg-[#C4A030] text-[#001F3F] font-bold px-6"
              data-testid="start-sequence-btn"
            >
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Start Sequence
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sequence Flow Visualization */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Sequence Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between max-w-3xl mx-auto py-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <Phone className="w-8 h-8 text-purple-600" />
              </div>
              <span className="text-sm font-medium">Voice Call</span>
              <span className="text-xs text-gray-500">Immediate</span>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <MessageSquare className="w-8 h-8 text-green-600" />
              </div>
              <span className="text-sm font-medium">WhatsApp/SMS</span>
              <span className="text-xs text-gray-500">+2 minutes</span>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <MessageSquare className="w-8 h-8 text-blue-600" />
              </div>
              <span className="text-sm font-medium">SMS</span>
              <span className="text-xs text-gray-500">+10 minutes</span>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <Mail className="w-8 h-8 text-orange-600" />
              </div>
              <span className="text-sm font-medium">Email</span>
              <span className="text-xs text-gray-500">+1 hour</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sequences */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <Users className="w-5 h-5 text-purple-500" />
            Outreach Sequences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sequences.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="sequences-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Lead</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Current Step</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Voice</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">WhatsApp</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">SMS</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Email</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sequences.map((seq) => (
                    <tr key={seq.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-sm">{seq.lead_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{seq.lead_phone}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={getStatusColor(seq.status)}>
                          {seq.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {getStepIcon(seq.current_step)}
                          <span className="text-sm capitalize">{seq.current_step}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={seq.voice_status ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {seq.voice_status || "pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={seq.whatsapp_status ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {seq.whatsapp_status || "pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={seq.sms_status ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {seq.sms_status || "pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={seq.email_status ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {seq.email_status || "pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {seq.status === "active" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => executeStep(seq.id, seq.current_step)}
                                className="h-8 w-8 p-0"
                                title="Execute current step"
                                data-testid={`execute-step-${seq.id}`}
                              >
                                <Play className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => pauseSequence(seq.id)}
                                className="h-8 w-8 p-0"
                                title="Pause"
                                data-testid={`pause-${seq.id}`}
                              >
                                <Pause className="w-4 h-4 text-yellow-600" />
                              </Button>
                            </>
                          )}
                          {seq.status === "paused" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resumeSequence(seq.id)}
                              className="h-8 w-8 p-0"
                              title="Resume"
                              data-testid={`resume-${seq.id}`}
                            >
                              <Play className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {seq.status !== "completed" && seq.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelSequence(seq.id)}
                              className="h-8 w-8 p-0"
                              title="Cancel"
                              data-testid={`cancel-${seq.id}`}
                            >
                              <XCircle className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No outreach sequences yet</p>
              <p className="text-sm">Select a lead above to start an omnichannel sequence</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
