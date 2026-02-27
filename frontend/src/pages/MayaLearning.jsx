import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Brain, TrendingUp, Star, DollarSign, MessageSquare, RefreshCw, Loader2, CheckCircle, BarChart3 } from "lucide-react";

export default function MayaLearning() {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState("");
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [dealStatus, setDealStatus] = useState("");
  const [dealValue, setDealValue] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const statsRes = await api.getLearningStats();
      const patternsRes = await api.getLearningPatterns();
      const convsRes = await api.getLearningConversations(20);
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

  const openRatingModal = (convId) => {
    setSelectedConvId(convId);
    setRating(0);
    setFeedback("");
    setDealStatus("");
    setDealValue(0);
    setShowRatingModal(true);
  };

  const closeRatingModal = () => {
    setShowRatingModal(false);
    setSelectedConvId("");
  };

  const submitRating = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      await api.rateConversation(selectedConvId, {
        conversation_id: selectedConvId,
        rating: rating,
        feedback: feedback,
        deal_status: dealStatus,
        deal_value: dealValue
      });
      toast.success("Rating submitted!");
      closeRatingModal();
      await loadData();
    } catch (error) {
      toast.error("Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (count, filled) => {
    const stars = [];
    for (let i = 1; i <= count; i++) {
      stars.push(
        <Star 
          key={i}
          className={`w-4 h-4 ${i <= filled ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  const renderRatingStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button key={i} onClick={() => setRating(i)} className="focus:outline-none">
          <Star className={`w-8 h-8 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        </button>
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="maya-learning-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Maya Learning Engine
          </h1>
          <p className="text-gray-500">Conversation analysis & broker feedback</p>
        </div>
        <Button onClick={loadData} variant="outline" className="rounded-full" data-testid="refresh-btn">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-white border shadow-sm" data-testid="total-conversations-card">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Conversations</p>
            <p className="text-3xl font-bold text-[#001F3F]">{stats?.total_conversations || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm" data-testid="qualification-rate-card">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Qualification</p>
            <p className="text-3xl font-bold text-green-600">{stats?.qualification_rate || 0}%</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm" data-testid="avg-confidence-card">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">AI Confidence</p>
            <p className="text-3xl font-bold text-blue-600">{stats?.avg_confidence || 0}%</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm" data-testid="broker-rating-card">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Broker Rating</p>
            <p className="text-3xl font-bold text-[#D4AF37]">{stats?.avg_broker_rating || 0}/5</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm" data-testid="deal-value-card">
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Revenue (AED)</p>
            <p className="text-2xl font-bold text-green-600">{(stats?.total_deal_value || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white border shadow-sm">
          <CardHeader>
            <CardTitle>Qualification Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between p-3 bg-green-50 rounded">
              <span>Qualified</span>
              <span className="font-bold text-green-600">{patterns?.qualified_count || 0}</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 rounded">
              <span>Total</span>
              <span className="font-bold text-blue-600">{patterns?.total_conversations || 0}</span>
            </div>
            <div className="flex justify-between p-3 bg-purple-50 rounded">
              <span>Rate</span>
              <span className="font-bold text-purple-600">{patterns?.qualification_rate || 0}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-sm">
          <CardHeader>
            <CardTitle>Deal Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 rounded">
                <p className="text-2xl font-bold text-green-600">{patterns?.deals?.won || 0}</p>
                <p className="text-xs text-gray-500">Won</p>
              </div>
              <div className="p-3 bg-red-50 rounded">
                <p className="text-2xl font-bold text-red-600">{patterns?.deals?.lost || 0}</p>
                <p className="text-xs text-gray-500">Lost</p>
              </div>
              <div className="p-3 bg-blue-50 rounded">
                <p className="text-xl font-bold text-blue-600">{(patterns?.deals?.total_value || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500">AED</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border shadow-sm">
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {conversations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="conversations-table">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm text-gray-500">Lead</th>
                    <th className="text-left py-3 px-2 text-sm text-gray-500">Duration</th>
                    <th className="text-left py-3 px-2 text-sm text-gray-500">Confidence</th>
                    <th className="text-left py-3 px-2 text-sm text-gray-500">Rating</th>
                    <th className="text-left py-3 px-2 text-sm text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((conv) => {
                    const duration = conv.duration_seconds || 0;
                    const mins = Math.floor(duration / 60);
                    const secs = Math.floor(duration % 60);
                    return (
                      <tr key={conv.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2 text-sm">{conv.lead_name || 'Unknown'}</td>
                        <td className="py-3 px-2 text-sm">{mins}:{secs.toString().padStart(2, '0')}</td>
                        <td className="py-3 px-2">
                          <Badge className={conv.ai_confidence >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                            {conv.ai_confidence || 0}%
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          {conv.broker_rating > 0 ? (
                            <div className="flex">{renderStars(5, conv.broker_rating)}</div>
                          ) : (
                            <span className="text-gray-400 text-sm">Not rated</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {!conv.broker_rating && (
                            <Button size="sm" variant="outline" onClick={() => openRatingModal(conv.id)} data-testid={`rate-${conv.id}`}>
                              Rate
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No conversations logged yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {showRatingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white">
            <CardHeader>
              <CardTitle>Rate Conversation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Rating</label>
                <div className="flex gap-2">{renderRatingStars()}</div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional feedback"
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Deal Status</label>
                <select value={dealStatus} onChange={(e) => setDealStatus(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Select...</option>
                  <option value="pending">In Progress</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              {dealStatus === 'won' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Deal Value (AED)</label>
                  <input type="number" value={dealValue} onChange={(e) => setDealValue(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={closeRatingModal} className="flex-1">Cancel</Button>
                <Button onClick={submitRating} disabled={submitting || rating === 0} className="flex-1 bg-[#001F3F]">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
