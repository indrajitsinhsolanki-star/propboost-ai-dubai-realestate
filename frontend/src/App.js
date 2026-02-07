import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";

// Pages
import Dashboard from "./pages/Dashboard";
import LeadInbox from "./pages/LeadInbox";
import ContentStudio from "./pages/ContentStudio";
import Pipeline from "./pages/Pipeline";
import LeadDetail from "./pages/LeadDetail";
import Analytics from "./pages/Analytics";
import VoiceAIDashboard from "./pages/VoiceAIDashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";

// Components
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// API Service with auth headers
const createApi = (token) => {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  return {
    // Auth
    login: (data) => axios.post(`${API}/auth/login`, data),
    signup: (data) => axios.post(`${API}/auth/signup`, data),
    getMe: () => axios.get(`${API}/auth/me`, { headers }),
    logout: () => axios.post(`${API}/auth/logout`, {}, { headers }),
    getSession: (sessionId) => axios.get(`${API}/auth/session`, { 
      headers: { ...headers, "X-Session-ID": sessionId }
    }),
    
    // Dashboard
    getDashboardStats: () => axios.get(`${API}/dashboard/stats`, { headers }),
    
    // Leads
    getLeads: (params) => axios.get(`${API}/leads`, { params, headers }),
    getLead: (id) => axios.get(`${API}/leads/${id}`, { headers }),
    createLead: (data) => axios.post(`${API}/leads`, data, { headers }),
    updateLead: (id, data) => axios.put(`${API}/leads/${id}`, data, { headers }),
    deleteLead: (id) => axios.delete(`${API}/leads/${id}`, { headers }),
    rescoreLead: (id) => axios.post(`${API}/leads/${id}/rescore`, {}, { headers }),
    
    // Properties
    getProperties: () => axios.get(`${API}/properties`, { headers }),
    getProperty: (id) => axios.get(`${API}/properties/${id}`, { headers }),
    createProperty: (data) => axios.post(`${API}/properties`, data, { headers }),
    deleteProperty: (id) => axios.delete(`${API}/properties/${id}`, { headers }),
    
    // Content
    generateContent: (data) => axios.post(`${API}/content/generate`, data, { headers }),
    getPropertyContent: (propertyId, params) => axios.get(`${API}/content/${propertyId}`, { params, headers }),
    approveContent: (contentId, approved) => axios.put(`${API}/content/${contentId}/approve`, { content_id: contentId, approved }, { headers }),
    
    // WhatsApp
    generateWhatsApp: (leadId, messageType, language) => 
      axios.post(`${API}/whatsapp/generate?lead_id=${leadId}&message_type=${messageType}&language=${language}`, {}, { headers }),
    approveWhatsApp: (messageId) => axios.put(`${API}/whatsapp/${messageId}/approve`, {}, { headers }),
    sendWhatsApp: (messageId) => axios.put(`${API}/whatsapp/${messageId}/send`, {}, { headers }),
    getLeadMessages: (leadId) => axios.get(`${API}/whatsapp/${leadId}`, { headers }),
    
    // Email
    generateEmail: (leadId, subject, messageType, language) =>
      axios.post(`${API}/email/generate?lead_id=${leadId}&subject=${encodeURIComponent(subject)}&message_type=${messageType}&language=${language}`, {}, { headers }),
    approveEmail: (messageId) => axios.put(`${API}/email/${messageId}/approve`, {}, { headers }),
    sendEmail: (messageId) => axios.put(`${API}/email/${messageId}/send`, {}, { headers }),
    
    // Voice AI
    triggerVoiceCall: (leadId, language) => axios.post(`${API}/voice/trigger-call`, { lead_id: leadId, language }, { headers }),
    getVoiceStats: () => axios.get(`${API}/voice/stats`, { headers }),
    getVoiceCallLogs: (limit) => axios.get(`${API}/voice/call-logs?limit=${limit || 20}`, { headers }),
    
    // Pipeline
    updatePipelineStage: (leadId, stage, probability) => 
      axios.put(`${API}/pipeline/${leadId}/stage?stage=${stage}${probability !== undefined ? `&probability=${probability}` : ''}`, {}, { headers }),
    getPipelineStats: () => axios.get(`${API}/pipeline/stats`, { headers }),
    
    // Analytics
    getLeaderboard: () => axios.get(`${API}/analytics/leaderboard`, { headers }),
    getScoreDistribution: () => axios.get(`${API}/analytics/score-distribution`, { headers }),
    getSourcePerformance: () => axios.get(`${API}/analytics/source-performance`, { headers }),
    
    // Activity Logs
    getActivityLogs: (limit) => axios.get(`${API}/activity-logs?limit=${limit || 50}`, { headers }),
    getComplianceAudits: (limit) => axios.get(`${API}/compliance-audits?limit=${limit || 50}`, { headers }),
  };
};

export const api = createApi(null);

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
}

function AppContent() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check for session_id in URL (OAuth callback)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  // Public routes (login, signup, password reset)
  const isPublicRoute = ['/login', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname);
  
  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // Handle public routes
  if (isPublicRoute) {
    // If user is already logged in, redirect to dashboard
    if (user) {
      return <Navigate to="/" replace />;
    }
    
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      {!isMobile && user && <Sidebar currentPath={location.pathname} />}
      
      {/* Main Content */}
      <main className={`${!isMobile && user ? 'md:ml-64' : ''} min-h-screen pb-24 md:pb-8`}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/leads" element={<ProtectedRoute><LeadInbox /></ProtectedRoute>} />
          <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><ContentStudio /></ProtectedRoute>} />
          <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/voice-ai" element={<ProtectedRoute><VoiceAIDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {/* Mobile Bottom Navigation */}
      {isMobile && user && <MobileNav currentPath={location.pathname} />}
      
      <Toaster position="top-right" richColors />
    </div>
  );
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('propboost_token'));
  const [loading, setLoading] = useState(true);
  
  const apiWithAuth = createApi(token);

  useEffect(() => {
    checkAuth();
  }, [token]);

  const checkAuth = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await apiWithAuth.getMe();
      setUser(response.data);
    } catch (error) {
      console.error("Auth check failed:", error);
      localStorage.removeItem('propboost_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await apiWithAuth.login({ email, password });
    const { user: userData, token: newToken } = response.data;
    localStorage.setItem('propboost_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const signup = async (data) => {
    const response = await apiWithAuth.signup(data);
    const { user: userData, token: newToken } = response.data;
    localStorage.setItem('propboost_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const loginWithGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleOAuthCallback = async (sessionId) => {
    try {
      const response = await axios.get(`${API}/auth/session`, {
        headers: { "X-Session-ID": sessionId }
      });
      const { user: userData, session_token } = response.data;
      
      // Store session token in cookie would be done server-side
      // For now, we store in localStorage
      localStorage.setItem('propboost_token', session_token);
      setToken(session_token);
      setUser(userData);
      return userData;
    } catch (error) {
      console.error("OAuth callback failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiWithAuth.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem('propboost_token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      signup,
      logout,
      loginWithGoogle,
      handleOAuthCallback,
      api: createApi(token)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
