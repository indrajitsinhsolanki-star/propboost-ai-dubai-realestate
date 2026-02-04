import { useState, useEffect } from "react";
import { useAuth } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Trophy, TrendingUp, DollarSign, Users, Target, Award, ArrowUp, ArrowDown } from "lucide-react";

const COLORS = ['#D4AF37', '#001F3F', '#3B82F6', '#10B981', '#F59E0B'];

export default function Analytics() {
  const { api } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [sourcePerformance, setSourcePerformance] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [leaderboardRes, performanceRes, scoreRes] = await Promise.all([
        api.getLeaderboard(),
        api.getSourcePerformance(),
        api.getScoreDistribution()
      ]);
      setLeaderboard(leaderboardRes.data.leaderboard || []);
      setSourcePerformance(performanceRes.data || []);
      setScoreDistribution(scoreRes.data || []);
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-[#D4AF37]" />;
      case 2:
        return <Award className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-gray-500 font-medium">{rank}</span>;
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
            <div className="h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalLeads = leaderboard.reduce((sum, item) => sum + item.total_leads, 0);
  const totalConversions = leaderboard.reduce((sum, item) => sum + item.converted_leads, 0);
  const totalRevenue = leaderboard.reduce((sum, item) => sum + item.total_projected_revenue, 0);
  const overallConversionRate = totalLeads > 0 ? (totalConversions / totalLeads * 100).toFixed(1) : 0;

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
          Analytics
        </h1>
        <p className="text-gray-500 mt-1">Track your lead source performance and conversion metrics</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#001F3F] border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Total Leads</p>
                <p className="text-3xl font-bold text-white mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {totalLeads}
                </p>
              </div>
              <Users className="w-10 h-10 text-white/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#D4AF37] border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/90">Conversions</p>
                <p className="text-3xl font-bold text-white mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {totalConversions}
                </p>
              </div>
              <Target className="w-10 h-10 text-white/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Conversion Rate</p>
                <p className="text-3xl font-bold text-[#001F3F] mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {overallConversionRate}%
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Projected Revenue</p>
                <p className="text-3xl font-bold text-[#D4AF37] mt-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-[#D4AF37]/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Source Leaderboard */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              <Trophy className="w-6 h-6 text-[#D4AF37]" />
              Top Performing Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-500">No data available yet</p>
                </div>
              ) : (
                leaderboard.map((item, index) => (
                  <div 
                    key={item.source}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                      item.rank === 1 ? 'bg-gradient-to-r from-[#D4AF37]/10 to-[#D4AF37]/5 border-2 border-[#D4AF37]' :
                      item.rank === 2 ? 'bg-gray-50 border border-gray-200' :
                      item.rank === 3 ? 'bg-orange-50/50 border border-orange-200' :
                      'bg-gray-50'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow">
                        {getRankIcon(item.rank)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-[#0F172A]">{item.source}</h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span>{item.total_leads} leads</span>
                          <span>•</span>
                          <span>{item.hot_leads} hot</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`text-lg font-bold ${
                          item.conversion_rate >= 20 ? 'text-green-600' :
                          item.conversion_rate >= 10 ? 'text-[#D4AF37]' :
                          'text-gray-500'
                        }`}>
                          {item.conversion_rate}%
                        </span>
                        {item.conversion_rate >= 20 && <ArrowUp className="w-4 h-4 text-green-600" />}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatCurrency(item.total_projected_revenue)} AED
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate Chart */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
              Conversion Rate by Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaderboard} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                  <XAxis type="number" domain={[0, 'auto']} unit="%" tick={{ fill: '#64748B', fontSize: 12 }} />
                  <YAxis type="category" dataKey="source" width={100} tick={{ fill: '#64748B', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#001F3F', border: 'none', borderRadius: '8px', color: 'white' }}
                    formatter={(value) => [`${value}%`, 'Conversion Rate']}
                  />
                  <Bar dataKey="conversion_rate" radius={[0, 4, 4, 0]}>
                    {leaderboard.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lead Score Distribution and Source Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Score Distribution */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
              Lead Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <XAxis dataKey="score" tick={{ fill: '#64748B', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#001F3F', border: 'none', borderRadius: '8px', color: 'white' }}
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
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm text-gray-500">Hot (8-10)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                <span className="text-sm text-gray-500">Warm (6-7)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-500">Cold (1-5)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Source Pie Chart */}
        <Card className="bg-white border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
              Revenue by Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leaderboard.filter(item => item.total_projected_revenue > 0)}
                    dataKey="total_projected_revenue"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {leaderboard.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#001F3F', border: 'none', borderRadius: '8px', color: 'white' }}
                    formatter={(value) => [`${formatCurrency(value)} AED`, 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Source Performance Table */}
      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl" style={{ fontFamily: 'Playfair Display, serif' }}>
            Detailed Source Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Source</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Total Leads</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Hot Leads</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Conversions</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Conv. Rate</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Avg Deal Value</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((item, index) => (
                  <tr key={item.source} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS[index % COLORS.length] + '20' }}>
                          <span className="text-sm font-bold" style={{ color: COLORS[index % COLORS.length] }}>{item.rank}</span>
                        </div>
                        <span className="font-medium">{item.source}</span>
                      </div>
                    </td>
                    <td className="text-center py-4 px-4">{item.total_leads}</td>
                    <td className="text-center py-4 px-4">
                      <Badge className="bg-red-100 text-red-600">{item.hot_leads}</Badge>
                    </td>
                    <td className="text-center py-4 px-4">{item.converted_leads}</td>
                    <td className="text-center py-4 px-4">
                      <span className={`font-medium ${
                        item.conversion_rate >= 20 ? 'text-green-600' :
                        item.conversion_rate >= 10 ? 'text-[#D4AF37]' :
                        'text-gray-500'
                      }`}>
                        {item.conversion_rate}%
                      </span>
                    </td>
                    <td className="text-center py-4 px-4">
                      {formatCurrency(item.avg_deal_value)} AED
                    </td>
                    <td className="text-right py-4 px-4 font-medium text-[#D4AF37]">
                      {formatCurrency(item.total_projected_revenue)} AED
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
