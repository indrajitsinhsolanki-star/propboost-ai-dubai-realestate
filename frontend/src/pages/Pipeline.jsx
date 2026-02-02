import { useState, useEffect } from "react";
import { api } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { 
  GripVertical,
  Phone,
  Mail,
  MoreVertical,
  TrendingUp,
  Loader2
} from "lucide-react";

const STAGES = [
  { id: "new", label: "New", color: "bg-gray-100" },
  { id: "qualified", label: "Qualified", color: "bg-blue-50" },
  { id: "viewing", label: "Viewing", color: "bg-yellow-50" },
  { id: "negotiation", label: "Negotiation", color: "bg-orange-50" },
  { id: "closing", label: "Closing", color: "bg-green-50" },
];

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [draggedLead, setDraggedLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [leadsRes, statsRes] = await Promise.all([
        api.getLeads(),
        api.getPipelineStats()
      ]);
      setLeads(leadsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Failed to load pipeline data");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, newStage) => {
    e.preventDefault();
    if (!draggedLead || draggedLead.stage === newStage) {
      setDraggedLead(null);
      return;
    }

    // Optimistic update
    const previousLeads = [...leads];
    setLeads(leads.map(l => 
      l.id === draggedLead.id ? {...l, stage: newStage} : l
    ));

    try {
      await api.updatePipelineStage(draggedLead.id, newStage);
      toast.success(`Moved to ${newStage}`);
    } catch (error) {
      // Rollback on error
      setLeads(previousLeads);
      toast.error("Failed to update stage");
    } finally {
      setDraggedLead(null);
    }
  };

  const handleUpdateProbability = async (leadId, probability) => {
    setUpdating(true);
    try {
      const lead = leads.find(l => l.id === leadId);
      await api.updatePipelineStage(leadId, lead.stage, probability);
      setLeads(leads.map(l => 
        l.id === leadId ? {...l, probability} : l
      ));
      toast.success("Probability updated");
    } catch (error) {
      toast.error("Failed to update probability");
    } finally {
      setUpdating(false);
    }
  };

  const getLeadsByStage = (stage) => leads.filter(l => l.stage === stage);

  const getScoreColor = (score) => {
    if (score >= 8) return "bg-red-500";
    if (score >= 6) return "bg-orange-400";
    return "bg-blue-500";
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="flex gap-4 overflow-x-auto">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-72 flex-shrink-0 h-96 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#0F172A]" style={{ fontFamily: 'Playfair Display, serif' }}>
            Pipeline Tracker
          </h1>
          <p className="text-gray-500 mt-1">Drag deals between stages to update</p>
        </div>
        
        {/* Stats Summary */}
        {stats && (
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#001F3F]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {stats.totals?.total || 0}
              </p>
              <p className="text-xs text-gray-500">Total Deals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {stats.stages?.closing?.count || 0}
              </p>
              <p className="text-xs text-gray-500">Closing</p>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline Board */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            const stageStats = stats?.stages?.[stage.id];
            
            return (
              <div
                key={stage.id}
                className="w-72 flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <Card className={`${stage.color} border-0 shadow-sm h-full min-h-[500px]`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        {stage.label}
                        <Badge variant="secondary" className="rounded-full">
                          {stageLeads.length}
                        </Badge>
                      </CardTitle>
                      {stageStats && (
                        <span className="text-xs text-gray-500">
                          Avg: {stageStats.avg_probability}%
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stageLeads.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                        <p className="text-sm text-gray-400">Drop deals here</p>
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          data-testid={`pipeline-card-${lead.id}`}
                          onDragStart={(e) => handleDragStart(e, lead)}
                          className={`bg-white p-4 rounded-xl shadow-sm cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                            draggedLead?.id === lead.id ? 'opacity-50 scale-95' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getScoreColor(lead.score)}`} />
                                <Link 
                                  to={`/leads/${lead.id}`}
                                  className="font-medium text-sm truncate hover:text-[#D4AF37]"
                                >
                                  {lead.name}
                                </Link>
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                <Phone className="w-3 h-3" />
                                <span className="truncate">{lead.phone}</span>
                              </div>
                            </div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  onClick={() => setSelectedLead(lead)}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-sm">
                                <DialogHeader>
                                  <DialogTitle>Update Deal</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                  <div>
                                    <p className="text-sm font-medium mb-2">Move to Stage</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {STAGES.map((s) => (
                                        <Button
                                          key={s.id}
                                          variant={lead.stage === s.id ? "default" : "outline"}
                                          size="sm"
                                          data-testid={`move-to-${s.id}`}
                                          disabled={lead.stage === s.id}
                                          onClick={async () => {
                                            try {
                                              await api.updatePipelineStage(lead.id, s.id);
                                              setLeads(leads.map(l => 
                                                l.id === lead.id ? {...l, stage: s.id} : l
                                              ));
                                              toast.success(`Moved to ${s.label}`);
                                            } catch (error) {
                                              toast.error("Failed to move deal");
                                            }
                                          }}
                                          className="text-xs"
                                        >
                                          {s.label}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium mb-2">Closure Probability</p>
                                    <Select 
                                      value={String(lead.probability)}
                                      onValueChange={(val) => handleUpdateProbability(lead.id, parseInt(val))}
                                    >
                                      <SelectTrigger data-testid="probability-select">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => (
                                          <SelectItem key={p} value={String(p)}>{p}%</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <DialogClose asChild>
                                    <Button className="w-full" variant="outline">Close</Button>
                                  </DialogClose>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>

                          {/* Probability Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-500">Probability</span>
                              <span className="font-medium text-[#D4AF37]">{lead.probability}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#D4AF37] rounded-full transition-all"
                                style={{ width: `${lead.probability}%` }}
                              />
                            </div>
                          </div>

                          {/* Property Interest */}
                          {lead.property_interests?.location && (
                            <p className="mt-2 text-xs text-gray-500 truncate">
                              {lead.property_interests.location} • {lead.property_interests.bedrooms || '?'} BR
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
          
          {/* Won/Lost Columns */}
          <div className="w-72 flex-shrink-0">
            <Card className="bg-green-50 border-0 shadow-sm h-full min-h-[500px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "won")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-green-700">
                  Won
                  <Badge className="bg-green-500 rounded-full">
                    {getLeadsByStage("won").length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getLeadsByStage("won").map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-green-200"
                  >
                    <Link to={`/leads/${lead.id}`} className="font-medium text-sm hover:text-green-600">
                      {lead.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">{lead.property_interests?.location}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          
          <div className="w-72 flex-shrink-0">
            <Card className="bg-red-50 border-0 shadow-sm h-full min-h-[500px]"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, "lost")}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-700">
                  Lost
                  <Badge className="bg-red-500 rounded-full">
                    {getLeadsByStage("lost").length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getLeadsByStage("lost").map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-red-200"
                  >
                    <Link to={`/leads/${lead.id}`} className="font-medium text-sm hover:text-red-600">
                      {lead.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">{lead.property_interests?.location}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
