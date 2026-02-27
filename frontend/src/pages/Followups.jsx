import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  Calendar,
  Phone,
  MessageSquare,
  Mail,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  UserCheck,
  AlertCircle,
  TrendingUp
} from "lucide-react";

export default function Followups() {
  const { api } = useAuth();
  const [cadences, setCadences] = useState([]);
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedLead, setSelectedLead] = useState("");
  const [triggerReason, setTriggerReason] = useState("missed_call");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cadRes, statsRes, leadsRes] = await Promise.all([
        api.getFollowupCadences(),
        api.getFollowupStats(),
        api.getLeads()
      ]);
      setCadences(cadRes.data);
      setStats(statsRes.data);
      setLeads(leadsRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load follow-up data");
    } finally {
      setLoading(false);
    }
  };

  const createCadence = async () => {
    if (!selectedLead) {
      toast.error("Please select a lead");
      return;
    }
    
    setCreating(true);
    try {
      await api.createFollowupCadence(selectedLead, triggerReason);
      toast.success("Follow-up cadence created!");
      setSelectedLead("");
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create cadence");
    } finally {
      setCreating(false);
    }
  };

  const executeDay = async (cadenceId, day) => {
    try {
      await api.executeFollowupDay(cadenceId, day);
      toast.success(`Executing Day ${day} follow-up...`);
      setTimeout(loadData, 2000);
    } catch (error) {
      toast.error("Failed to execute follow-up");
    }
  };

  const markResponded = async (cadenceId) => {
    try {
      await api.markFollowupResponded(cadenceId);
      toast.success("Lead marked as responded!");
      loadData();
    } catch (error) {
      toast.error("Failed to update");
    }
  };

  const cancelCadence = async (cadenceId) => {
    try {
      await api.cancelFollowupCadence(cadenceId);
      toast.success("Cadence cancelled");
      loadData();
    } catch (error) {
      toast.error("Failed to cancel");
    }
  };

  const getDayIcon = (day) => {
    const icons = {
      1: <Phone className="w-4 h-4" />,
      2: <MessageSquare className="w-4 h-4" />,
      4: <Phone className="w-4 h-4" />,
      7: <Mail className="w-4 h-4" />
    };
    return icons[day] || <Calendar className="w-4 h-4" />;
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "active": return "bg-green-100 text-green-700 border-green-200";
      case "completed": return "bg-blue-100 text-blue-700 border-blue-200";
      case "responded": return "bg-purple-100 text-purple-700 border-purple-200";
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
    <div className="p-4 md:p-8 space-y-6" data-testid="followups-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Automated Follow-ups
          </h1>
          <p className="text-gray-500">System-driven cadence: Day 1 → Day 2 → Day 4 → Day 7</p>
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="total-cadences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Cadences</p>
                <p className="text-3xl font-bold text-[#001F3F]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.total_cadences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="active-cadences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-3xl font-bold text-green-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.active_cadences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="responded-cadences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Responded</p>
                <p className="text-3xl font-bold text-purple-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.responded_cadences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="completed-cadences-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-3xl font-bold text-blue-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.completed_cadences || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="response-rate-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Response Rate</p>
                <p className="text-3xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.response_rate || 0}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#D4AF37]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create New Cadence */}
      <Card className="bg-gradient-to-r from-[#001F3F] to-[#003366] text-white">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
            Create Follow-up Cadence
          </h3>
          <p className="text-gray-300 mb-4">
            Automated sequence: Day 1 (Trigger) → Day 2 (WhatsApp) → Day 4 (Call) → Day 7 (Final Email)
          </p>
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={selectedLead}
              onChange={(e) => setSelectedLead(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              data-testid="lead-select"
            >
              <option value="" className="text-gray-900">Select a lead...</option>
              {leads.map(lead => (
                <option key={lead.id} value={lead.id} className="text-gray-900">
                  {lead.name} - {lead.phone} (Score: {lead.score})
                </option>
              ))}
            </select>
            <select
              value={triggerReason}
              onChange={(e) => setTriggerReason(e.target.value)}
              className="md:w-48 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              data-testid="trigger-select"
            >
              <option value="missed_call" className="text-gray-900">Missed Call</option>
              <option value="no_response" className="text-gray-900">No Response</option>
              <option value="callback_requested" className="text-gray-900">Callback Requested</option>
            </select>
            <Button
              onClick={createCadence}
              disabled={creating || !selectedLead}
              className="bg-[#D4AF37] hover:bg-[#C4A030] text-[#001F3F] font-bold px-6"
              data-testid="create-cadence-btn"
            >
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              Create Cadence
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cadence Timeline Visualization */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>Follow-up Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between max-w-4xl mx-auto py-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-2">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <span className="text-sm font-medium">Day 1</span>
              <span className="text-xs text-gray-500">Trigger Event</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <MessageSquare className="w-8 h-8 text-green-600" />
              </div>
              <span className="text-sm font-medium">Day 2</span>
              <span className="text-xs text-gray-500">WhatsApp/SMS</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <Phone className="w-8 h-8 text-purple-600" />
              </div>
              <span className="text-sm font-medium">Day 4</span>
              <span className="text-xs text-gray-500">Voice Call</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                <Mail className="w-8 h-8 text-orange-600" />
              </div>
              <span className="text-sm font-medium">Day 7</span>
              <span className="text-xs text-gray-500">Final Email</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Cadences */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <Calendar className="w-5 h-5 text-purple-500" />
            Follow-up Cadences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cadences.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="cadences-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Lead</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Trigger</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Day 1</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Day 2</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Day 4</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Day 7</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Next Action</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cadences.map((cad) => (
                    <tr key={cad.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-sm">{cad.lead_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{cad.lead_phone}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={getStatusColor(cad.status)}>
                          {cad.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-sm text-gray-600">{cad.trigger_reason?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={cad.day_1_completed ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {cad.day_1_completed ? "Done" : "Pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={cad.day_2_completed ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {cad.day_2_completed ? "Done" : "Pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={cad.day_4_completed ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {cad.day_4_completed ? "Done" : "Pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={cad.day_7_completed ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}>
                          {cad.day_7_completed ? "Done" : "Pending"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {cad.status === "active" && cad.next_action_day && (
                          <span className="text-sm text-purple-600 font-medium">Day {cad.next_action_day}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {cad.status === "active" && cad.next_action_day && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => executeDay(cad.id, cad.next_action_day)}
                              className="h-8 w-8 p-0"
                              title={`Execute Day ${cad.next_action_day}`}
                              data-testid={`execute-day-${cad.id}`}
                            >
                              <Play className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {cad.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markResponded(cad.id)}
                              className="h-8 w-8 p-0"
                              title="Mark as Responded"
                              data-testid={`mark-responded-${cad.id}`}
                            >
                              <UserCheck className="w-4 h-4 text-purple-600" />
                            </Button>
                          )}
                          {cad.status === "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelCadence(cad.id)}
                              className="h-8 w-8 p-0"
                              title="Cancel"
                              data-testid={`cancel-${cad.id}`}
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
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No follow-up cadences yet</p>
              <p className="text-sm">Create a cadence above to automate your follow-ups</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
