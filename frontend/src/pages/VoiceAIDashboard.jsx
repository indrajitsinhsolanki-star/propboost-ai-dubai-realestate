import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  PhoneMissed,
  Clock, 
  TrendingUp,
  Users,
  Mic,
  BarChart3,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function VoiceAIDashboard() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        api.getVoiceStats(),
        api.getVoiceCallLogs(20)
      ]);
      setStats(statsRes.data);
      setCallLogs(logsRes.data);
    } catch (error) {
      console.error("Failed to load voice data:", error);
      toast.error("Failed to load voice AI data");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "initiated": return <PhoneCall className="w-4 h-4 text-blue-500" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-500" />;
      case "no-answer": return <PhoneMissed className="w-4 h-4 text-orange-500" />;
      default: return <Phone className="w-4 h-4 text-gray-500" />;
    }
  };

  const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6B7280'];

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>)}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const pieData = stats ? [
    { name: 'Answered', value: stats.calls_answered, color: '#10B981' },
    { name: 'No Answer', value: stats.calls_no_answer, color: '#F59E0B' },
    { name: 'Failed', value: stats.calls_failed, color: '#EF4444' },
  ].filter(d => d.value > 0) : [];

  const qualificationData = stats ? [
    { name: 'Interested', value: stats.qualified_interested, fill: '#10B981' },
    { name: 'Not Interested', value: stats.qualified_not_interested, fill: '#EF4444' },
    { name: 'Callback', value: stats.qualified_callback, fill: '#F59E0B' },
    { name: 'Unknown', value: stats.qualified_unknown, fill: '#6B7280' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="voice-ai-dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Voice AI Dashboard
          </h1>
          <p className="text-gray-500">Maya's performance analytics for Dubai market</p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="rounded-full"
          data-testid="refresh-voice-stats-btn"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="total-calls-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Calls</p>
                <p className="text-3xl font-bold text-[#001F3F]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.total_calls || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Phone className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="calls-answered-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Answered</p>
                <p className="text-3xl font-bold text-green-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.calls_answered || 0}
                </p>
                <p className="text-xs text-gray-400">
                  {stats?.total_calls > 0 ? Math.round((stats.calls_answered / stats.total_calls) * 100) : 0}% rate
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <PhoneCall className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="qualification-rate-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Qualified</p>
                <p className="text-3xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.qualification_rate || 0}%
                </p>
                <p className="text-xs text-gray-400">
                  {stats?.qualified_interested || 0} interested
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#D4AF37]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="avg-confidence-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">AI Confidence</p>
                <p className="text-3xl font-bold text-indigo-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.avg_confidence || 0}%
                </p>
                <p className="text-xs text-gray-400">
                  avg per call
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="avg-talk-time-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Talk Time</p>
                <p className="text-3xl font-bold text-blue-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {formatDuration(stats?.avg_duration_seconds)}
                </p>
                <p className="text-xs text-gray-400">
                  avg per call
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Call Outcomes Pie Chart */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Phone className="w-5 h-5 text-purple-500" />
              Call Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No call data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Qualification Results Bar Chart */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Users className="w-5 h-5 text-[#D4AF37]" />
              Lead Qualification Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {qualificationData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={qualificationData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={100} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No qualification data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Call Logs */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <Mic className="w-5 h-5 text-purple-500" />
            Recent Maya Calls
          </CardTitle>
        </CardHeader>
        <CardContent>
          {callLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="call-logs-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Lead</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Duration</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Confidence</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Outcome</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Recording</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {callLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-sm">{log.lead_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{log.lead_phone || ''}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <span className="text-sm capitalize">{log.status}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-sm">
                        {formatDuration(log.duration_seconds)}
                      </td>
                      <td className="py-3 px-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            log.qualification_result === 'interested' ? 'bg-green-50 text-green-700 border-green-200' :
                            log.qualification_result === 'not_interested' ? 'bg-red-50 text-red-700 border-red-200' :
                            log.qualification_result === 'callback' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {log.qualification_result || 'N/A'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {log.recording_url ? (
                          <a 
                            href={log.recording_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-sm"
                            data-testid={`recording-link-${log.id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Listen
                          </a>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleDateString('en-AE', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <Mic className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No call logs yet</p>
              <p className="text-sm">Maya will start calling when hot leads (score &gt; 7) are created</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
