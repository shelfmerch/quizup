import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Camera } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup, refreshUser, googleLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(username, email, password);
      if (avatar) {
        try {
          await profileService.uploadAvatar(avatar);
          await refreshUser();
        } catch (err) {
          console.error("Avatar upload failed during signup", err);
        }
      }
      navigate("/home");
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
        <h1 className="font-display font-bold text-foreground text-base">Create Account</h1>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-6">
            <div 
              className="relative w-24 h-24 rounded-full bg-quizup-card border-2 border-border flex items-center justify-center cursor-pointer overflow-hidden group"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="QuizMaster"
              className="h-12 bg-quizup-card border-border text-foreground"
              required
            />
          </div>
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
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 rounded-lg quizup-header-green text-foreground font-display font-bold text-base disabled:opacity-50"
          >
            {loading ? "Creating..." : "CREATE ACCOUNT"}
          </button>
        </form>

        {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
          <>
            <p className="text-center text-xs text-muted-foreground mt-5 mb-2 uppercase tracking-wider">or</p>
            <div className="mt-1 flex justify-center">
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
                onError={() => {}}
                useOneTap={false}
                text="signup_with"
                theme="filled_black"
                size="large"
                width="100%"
              />
            </div>
          </>
        ) : null}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")} className="text-quizup-green font-semibold">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default Signup;
