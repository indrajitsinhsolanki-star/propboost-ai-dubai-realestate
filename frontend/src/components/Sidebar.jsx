import { Link } from "react-router-dom";
import { useAuth } from "../App";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  GitBranch,
  Settings,
  LogOut,
  Sparkles,
  BarChart3
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/leads", icon: Users, label: "Lead Inbox" },
  { path: "/content", icon: FileText, label: "Content Studio" },
  { path: "/pipeline", icon: GitBranch, label: "Pipeline" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
];

export default function Sidebar({ currentPath }) {
  const { user, logout } = useAuth();
  
  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#001F3F] text-white h-screen fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              PropBoost
            </h1>
            <p className="text-xs text-white/60">AI Powered</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.path || 
            (item.path !== "/" && currentPath.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? "bg-[#D4AF37] text-white shadow-lg" 
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-white/10">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/10 hover:text-white rounded-xl transition-all"
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </Link>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all w-full mt-1"
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>

      {/* Agent Info */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center overflow-hidden">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#D4AF37] font-semibold">
                {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-white/50">{user?.company || 'Solo Plan'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
