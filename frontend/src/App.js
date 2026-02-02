import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";

// Pages
import Dashboard from "./pages/Dashboard";
import LeadInbox from "./pages/LeadInbox";
import ContentStudio from "./pages/ContentStudio";
import Pipeline from "./pages/Pipeline";
import LeadDetail from "./pages/LeadDetail";

// Components
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// API Service
export const api = {
  // Dashboard
  getDashboardStats: () => axios.get(`${API}/dashboard/stats`),
  
  // Leads
  getLeads: (params) => axios.get(`${API}/leads`, { params }),
  getLead: (id) => axios.get(`${API}/leads/${id}`),
  createLead: (data) => axios.post(`${API}/leads`, data),
  updateLead: (id, data) => axios.put(`${API}/leads/${id}`, data),
  deleteLead: (id) => axios.delete(`${API}/leads/${id}`),
  rescoreLead: (id) => axios.post(`${API}/leads/${id}/rescore`),
  
  // Properties
  getProperties: () => axios.get(`${API}/properties`),
  getProperty: (id) => axios.get(`${API}/properties/${id}`),
  createProperty: (data) => axios.post(`${API}/properties`, data),
  deleteProperty: (id) => axios.delete(`${API}/properties/${id}`),
  
  // Content
  generateContent: (data) => axios.post(`${API}/content/generate`, data),
  getPropertyContent: (propertyId, params) => axios.get(`${API}/content/${propertyId}`, { params }),
  approveContent: (contentId, approved) => axios.put(`${API}/content/${contentId}/approve`, { content_id: contentId, approved }),
  
  // WhatsApp
  generateWhatsApp: (leadId, messageType, language) => 
    axios.post(`${API}/whatsapp/generate?lead_id=${leadId}&message_type=${messageType}&language=${language}`),
  approveWhatsApp: (messageId) => axios.put(`${API}/whatsapp/${messageId}/approve`),
  sendWhatsApp: (messageId) => axios.put(`${API}/whatsapp/${messageId}/send`),
  getLeadMessages: (leadId) => axios.get(`${API}/whatsapp/${leadId}`),
  
  // Pipeline
  updatePipelineStage: (leadId, stage, probability) => 
    axios.put(`${API}/pipeline/${leadId}/stage?stage=${stage}${probability !== undefined ? `&probability=${probability}` : ''}`),
  getPipelineStats: () => axios.get(`${API}/pipeline/stats`),
  
  // Activity Logs
  getActivityLogs: (limit) => axios.get(`${API}/activity-logs?limit=${limit || 50}`),
};

function AppContent() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar currentPath={location.pathname} />}
      
      {/* Main Content */}
      <main className={`${!isMobile ? 'md:ml-64' : ''} min-h-screen pb-24 md:pb-8`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<LeadInbox />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/content" element={<ContentStudio />} />
          <Route path="/pipeline" element={<Pipeline />} />
        </Routes>
      </main>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileNav currentPath={location.pathname} />}
      
      <Toaster position="top-right" richColors />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
