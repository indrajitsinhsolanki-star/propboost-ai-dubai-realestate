import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleOAuthCallback } = useAuth();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extract session_id from URL hash
        const hash = location.hash || window.location.hash;
        const params = new URLSearchParams(hash.replace('#', ''));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          throw new Error("No session ID found");
        }

        await handleOAuthCallback(sessionId);
        toast.success("Welcome to PropBoost AI!");
        
        // Clean URL and redirect
        window.history.replaceState({}, document.title, window.location.pathname);
        navigate("/", { replace: true });
      } catch (error) {
        console.error("Auth callback error:", error);
        toast.error("Authentication failed. Please try again.");
        navigate("/login", { replace: true });
      }
    };

    processCallback();
  }, [location, navigate, handleOAuthCallback]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001F3F] to-[#001F3F]/80 flex items-center justify-center">
      <div className="text-center text-white">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
        <p className="text-lg">Completing authentication...</p>
      </div>
    </div>
  );
}
