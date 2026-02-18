import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/**
 * OAUTH CALLBACK FIX - CRITICAL:
 * 
 * ROOT CAUSE: Previously, navigate() was called immediately after handleOAuthCallback(),
 * but React state hadn't propagated yet. The dashboard would redirect back to login
 * because user was still null when the route was evaluated.
 * 
 * FIX: Use useEffect to watch for user state changes. Only navigate
 * to dashboard AFTER the user state is confirmed to be set.
 * This ensures the auth state is fully propagated before navigation.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleOAuthCallback, user } = useAuth();
  const callbackProcessed = useRef(false);
  const [error, setError] = useState(null);

  // Process the OAuth callback once
  useEffect(() => {
    const processCallback = async () => {
      if (callbackProcessed.current) return;
      callbackProcessed.current = true;
      
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
        
        // Clean URL - navigation will happen via useEffect when user state is set
        window.history.replaceState({}, document.title, window.location.pathname);
        // DO NOT navigate here - useEffect below will handle it after state updates
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err);
        toast.error("Authentication failed. Please try again.");
        navigate("/login", { replace: true });
      }
    };

    processCallback();
  }, [location, handleOAuthCallback, navigate]);

  // CRITICAL FIX: Navigate to dashboard only AFTER user state is set
  useEffect(() => {
    if (user && callbackProcessed.current && !error) {
      // User is now logged in after OAuth - safe to navigate
      navigate("/", { replace: true });
    }
  }, [user, navigate, error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001F3F] to-[#001F3F]/80 flex items-center justify-center">
      <div className="text-center text-white">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
        <p className="text-lg">Completing authentication...</p>
      </div>
    </div>
  );
}
