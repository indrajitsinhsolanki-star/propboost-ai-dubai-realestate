import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Flame,
  ThermometerSun,
  Snowflake,
  ArrowRight,
  Sparkles,
  CheckCircle,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Dashboard() {
  const { api, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await api.getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const leadData = stats?.leads || { total: 0, hot: 0, warm: 0, cold: 0 };
  const pipelineData = stats?.pipeline || {};
  const contentData = stats?.content || { total: 0, approved: 0, pending: 0 };
  const scoreDistribution = stats?.score_distribution || [];

  const statCards = [
    { 
      label: "Total Leads", 
      value: leadData.total, 
      icon: Users, 
      color: "bg-[#001F3F]",
      textColor: "text-white"
    },
    { 
      label: "Hot Leads", 
      value: leadData.hot, 
      icon: Flame, 
      color: "bg-red-500",
      textColor: "text-white"
    },
    { 
      label: "Warm Leads", 
      value: leadData.warm, 
      icon: ThermometerSun, 
      color: "bg-orange-400",
      textColor: "text-white"
    },
    { 
      label: "Cold Leads", 
      value: leadData.cold, 
      icon: Snowflake, 
      color: "bg-blue-500",
      textColor: "text-white"
    },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Welcome back, {user?.name?.split(' ')[0] || 'Agent'}. Here's your overview.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/leads">
            <Button 
              data-testid="dashboard-add-lead-btn"
              className="bg-[#001F3F] hover:bg-[#001F3F]/90 text-white rounded-full px-6"
            >
              <Users className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </Link>
          <Link to="/content">
            <Button 
              data-testid="dashboard-create-content-btn"
              className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-white rounded-full px-6"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Content
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card 
            key={stat.label} 
            className={`${stat.color} border-0 card-hover animate-fade-in`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${stat.textColor} opacity-80`}>{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.textColor} mt-2`} style={{ fontFamily: 'Playfair Display, serif' }}>
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full bg-white/20 flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Distribution Chart */}
        <Card className="lg:col-span-2 bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
              Lead Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <XAxis 
                    dataKey="score" 
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis 
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#001F3F', 
                      border: 'none', 
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scoreDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.score >= 8 ? '#EF4444' : entry.score >= 6 ? '#F59E0B' : '#3B82F6'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Content Performance */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
              Content Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{contentData.approved}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Review</p>
                  <p className="text-2xl font-bold text-orange-500">{contentData.pending}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#001F3F] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Generated</p>
                  <p className="text-2xl font-bold text-[#001F3F]">{contentData.total}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Summary */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-semibold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Pipeline Overview
          </CardTitle>
          <Link to="/pipeline">
            <Button variant="ghost" className="text-[#D4AF37] hover:text-[#D4AF37]/80">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {["new", "qualified", "viewing", "negotiation", "closing"].map((stage) => (
              <div key={stage} className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 capitalize">{stage}</p>
                <p className="text-2xl font-bold text-[#001F3F] mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {pipelineData[stage] || 0}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/leads" className="group">
          <Card className="bg-gradient-to-br from-[#001F3F] to-[#001F3F]/80 border-0 card-hover cursor-pointer">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">Score New Leads</h3>
                <p className="text-white/60 text-sm mt-1">AI-powered qualification</p>
              </div>
              <ArrowRight className="w-6 h-6 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/content" className="group">
          <Card className="bg-gradient-to-br from-[#D4AF37] to-[#D4AF37]/80 border-0 card-hover cursor-pointer">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">Generate Content</h3>
                <p className="text-white/80 text-sm mt-1">6 languages, 5 platforms</p>
              </div>
              <ArrowRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/pipeline" className="group">
          <Card className="bg-white border border-gray-200 card-hover cursor-pointer">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-[#0F172A] font-semibold text-lg">Track Deals</h3>
                <p className="text-gray-500 text-sm mt-1">Visual pipeline management</p>
              </div>
              <ArrowRight className="w-6 h-6 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
