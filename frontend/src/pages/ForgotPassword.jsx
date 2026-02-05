import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Sparkles, Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import axios from "axios";
import { API } from "../App";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/auth/password-reset`, { email });
      setSent(true);
      toast.success("Reset instructions sent to your email");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#001F3F] to-[#001F3F]/80 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl border-0">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
              Check Your Email
            </h2>
            <p className="text-gray-600">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Didn&apos;t receive the email? Check your spam folder or try again.
            </p>
            <div className="pt-4 space-y-3">
              <Button 
                variant="outline"
                className="w-full rounded-full"
                onClick={() => setSent(false)}
              >
                Try another email
              </Button>
              <Link to="/login">
                <Button className="w-full bg-[#001F3F] hover:bg-[#001F3F]/90 rounded-full">
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001F3F] to-[#001F3F]/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-[#D4AF37] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            Reset Password
          </CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you instructions to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  data-testid="forgot-password-email-input"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#D4AF37] hover:bg-[#D4AF37]/90 rounded-full"
              data-testid="forgot-password-submit-btn"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
              ) : (
                "Send Reset Instructions"
              )}
            </Button>
          </form>

          <Link to="/login" className="block">
            <Button variant="ghost" className="w-full rounded-full text-gray-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
