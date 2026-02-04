import { Link } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  GitBranch,
  BarChart3
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Home" },
  { path: "/leads", icon: Users, label: "Leads" },
  { path: "/content", icon: FileText, label: "Content" },
  { path: "/pipeline", icon: GitBranch, label: "Pipeline" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
];

export default function MobileNav({ currentPath }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = currentPath === item.path || 
            (item.path !== "/" && currentPath.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive 
                  ? "text-[#D4AF37]" 
                  : "text-gray-500"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
              <span className={`text-xs mt-1 ${isActive ? "font-semibold" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
