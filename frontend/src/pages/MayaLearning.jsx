import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  Brain,
  TrendingUp,
  Star,
  DollarSign,
  Clock,
  MessageSquare,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export default function MayaLearning() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingConversation, setRatingConversation] = useState(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [dealStatus, setDealStatus] = useState("");
  const [dealValue, setDealValue] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, patternsRes, convsRes] = await Promise.all([
        api.getLearningStats(),
        api.getLearningPatterns(),
        api.getLearningConversations(20)
      ]);
      setStats(statsRes.data);
      setPatterns(patternsRes.data);
      setConversations(convsRes.data);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load learning data");
    } finally {
      setLoading(false);
    }
  };

  const submitRating = async () => {
    if (!ratingConversation || rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    
    setSubmittingRating(true);
    try {
      await api.rateConversation(ratingConversation, {
        conversation_id: ratingConversation,
        rating,
        feedback,
        deal_status: dealStatus,
        deal_value: dealValue
      });
      toast.success("Rating submitted! Maya is learning...");
      setRatingConversation(null);
      setRating(0);
      setFeedback("");
      setDealStatus("");
      setDealValue(0);
      await loadData();
    } catch (error) {
      toast.error("Failed to submit rating");
    } finally {
      setSubmittingRating(false);
    }
  };

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

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

  const outcomeData = patterns ? [
    { name: 'Qualified', value: patterns.qualified_count || 0, fill: '#10B981' },
    { name: 'Not Qualified', value: (patterns.total_conversations || 0) - (patterns.qualified_count || 0), fill: '#EF4444' }
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="maya-learning-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Maya Learning Engine
          </h1>
          <p className="text-gray-500">Continuous improvement through conversation analysis & broker feedback</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="total-conversations-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Conversations</p>
                <p className="text-3xl font-bold text-[#001F3F]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.total_conversations || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="qualification-rate-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Qualification</p>
                <p className="text-3xl font-bold text-green-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.qualification_rate || 0}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="avg-confidence-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">AI Confidence</p>
                <p className="text-3xl font-bold text-blue-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.avg_confidence || 0}%
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="broker-rating-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Broker Rating</p>
                <p className="text-3xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {stats?.avg_broker_rating || 0}/5
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Star className="w-6 h-6 text-[#D4AF37]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-gray-100 shadow-sm" data-testid="deal-value-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-2xl font-bold text-green-600" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {(stats?.total_deal_value || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-400">AED</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {patterns?.insights && patterns.insights.length > 0 && (
        <Card className="bg-gradient-to-r from-[#001F3F] to-[#003366] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Lightbulb className="w-5 h-5 text-[#D4AF37]" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {patterns.insights.map((insight, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-lg ${
                    insight.type === 'positive' ? 'bg-green-500/20 border border-green-400/30' :
                    insight.type === 'warning' ? 'bg-yellow-500/20 border border-yellow-400/30' :
                    insight.type === 'success' ? 'bg-blue-500/20 border border-blue-400/30' :
                    'bg-white/10 border border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {insight.type === 'positive' && <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />}
                    {insight.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />}
                    {insight.type === 'success' && <TrendingUp className="w-5 h-5 text-blue-400 mt-0.5" />}
                    <p className="text-sm">{insight.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Qualification Outcomes */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <TrendingUp className="w-5 h-5 text-green-500" />
              Qualification Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {outcomeData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {outcomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No data yet - Maya needs more conversations
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deal Performance */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <DollarSign className="w-5 h-5 text-green-500" />
              Deal Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patterns?.deals ? (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{patterns.deals.won}</p>
                    <p className="text-sm text-gray-500">Deals Won</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{patterns.deals.lost}</p>
                    <p className="text-sm text-gray-500">Deals Lost</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{patterns.deals.total_value?.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Total AED</p>
                  </div>
                </div>
                <div className="text-center text-sm text-gray-500">
                  Win rate: {patterns.deals.won + patterns.deals.lost > 0 
                    ? Math.round(patterns.deals.won / (patterns.deals.won + patterns.deals.lost) * 100) 
                    : 0}%
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No deal data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversations */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <MessageSquare className="w-5 h-5 text-purple-500" />
            Recent Conversations - Rate for Learning
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conversations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="conversations-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Lead</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Duration</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">AI Confidence</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Outcome</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Broker Rating</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Deal Status</th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conv) => (
                    <tr key={conv.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <p className="font-medium text-sm">{conv.lead_name || 'Unknown'}</p>
                      </td>
                      <td className="py-3 px-2 text-sm">
                        {Math.floor(conv.duration_seconds / 60)}:{String(Math.floor(conv.duration_seconds % 60)).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-2">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                          conv.ai_confidence >= 70 ? 'bg-green-100 text-green-700' :
                          conv.ai_confidence >= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {conv.ai_confidence}%
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={
                          conv.outcome === 'qualified' ? 'bg-green-50 text-green-700' :
                          conv.outcome === 'not_qualified' ? 'bg-red-50 text-red-700' :
                          'bg-gray-50 text-gray-700'
                        }>
                          {conv.outcome || 'pending'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {conv.broker_rating > 0 ? (
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5].map(star => (
                              <Star 
                                key={star}
                                className={`w-4 h-4 ${star <= conv.broker_rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Not rated</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={
                          conv.deal_status === 'won' ? 'bg-green-50 text-green-700' :
                          conv.deal_status === 'lost' ? 'bg-red-50 text-red-700' :
                          'bg-gray-50 text-gray-500'
                        }>
                          {conv.deal_status || 'pending'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2">
                        {conv.broker_rating === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRatingConversation(conv.id)}
                            className="text-xs"
                            data-testid={`rate-${conv.id}`}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            Rate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No conversations logged yet</p>
              <p className="text-sm">Maya will learn as she talks to more leads</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rating Modal */}
      {ratingConversation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white">
            <CardHeader>
              <CardTitle style={{ fontFamily: 'Playfair Display, serif' }}>
                Rate This Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  How well did Maya handle this call?
                </label>
                <div className="flex items-center gap-2">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className="focus:outline-none"
                      data-testid={`star-${star}`}
                    >
                      <Star 
                        className={`w-8 h-8 transition-colors ${
                          star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Feedback (optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What could Maya improve?"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                  rows={3}
                  data-testid="feedback-input"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Deal Status
                </label>
                <select
                  value={dealStatus}
                  onChange={(e) => setDealStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                  data-testid="deal-status-select"
                >
                  <option value="">Select...</option>
                  <option value="pending">Still in Progress</option>
                  <option value="won">Deal Won</option>
                  <option value="lost">Deal Lost</option>
                </select>
              </div>

              {dealStatus === 'won' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Deal Value (AED)
                  </label>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={(e) => setDealValue(Number(e.target.value))}
                    placeholder="e.g., 2500000"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:outline-none"
                    data-testid="deal-value-input"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRatingConversation(null);
                    setRating(0);
                    setFeedback("");
                    setDealStatus("");
                    setDealValue(0);
                  }}
                  className="flex-1"
                  data-testid="cancel-rating-btn"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitRating}
                  disabled={submittingRating || rating === 0}
                  className="flex-1 bg-[#001F3F] hover:bg-[#002855]"
                  data-testid="submit-rating-btn"
                >
                  {submittingRating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Submit Rating
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
