import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : "/home");
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-quizup-dark flex flex-col max-w-md mx-auto">
      <div className="quizup-header-teal px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-foreground text-base">Sign In</h1>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 bg-quizup-card border-border text-foreground"
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 bg-quizup-card border-border text-foreground"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-lg quizup-header-green text-foreground font-display font-bold text-base disabled:opacity-50"
          >
            {loading ? "Signing in..." : "SIGN IN"}
          </button>
        </form>

        {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
          <div className="mt-4 flex justify-center">
            <GoogleLogin
              onSuccess={async (res) => {
                if (!res.credential) return;
                setLoading(true);
                try {
                  const user = await googleLogin(res.credential);
                  navigate(user.role === "admin" ? "/admin" : "/home");
                } finally {
                  setLoading(false);
                }
              }}
              onError={() => {
                // noop (UI already has minimal error handling elsewhere)
              }}
              useOneTap={false}
            />
          </div>
        ) : null}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <button onClick={() => navigate("/signup")} className="text-quizup-green font-semibold">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
