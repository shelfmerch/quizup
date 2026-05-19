import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import { resolveMediaUrl } from "@/config/env";
import { Input } from "@/components/ui/input";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Bangladesh","Belgium",
  "Brazil","Canada","Chile","China","Colombia","Croatia","Czech Republic","Denmark","Egypt",
  "Ethiopia","Finland","France","Germany","Ghana","Greece","Hungary","India","Indonesia",
  "Iran","Iraq","Ireland","Israel","Italy","Japan","Jordan","Kenya","South Korea","Kuwait",
  "Lebanon","Malaysia","Mexico","Morocco","Netherlands","New Zealand","Nigeria","Norway",
  "Pakistan","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Saudi Arabia",
  "Senegal","South Africa","Spain","Sri Lanka","Sweden","Switzerland","Tanzania","Thailand",
  "Turkey","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
  "Venezuela","Vietnam","Zimbabwe",
];

const OnboardingProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [country, setCountry] = useState(user?.country || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const currentAvatar = avatarPreview
    ?? resolveMediaUrl(user?.avatarUrl, `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.username ?? "user")}`);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleContinue = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter your display name");
      return;
    }
    setSaving(true);
    try {
      if (avatarFile) {
        await profileService.uploadAvatar(avatarFile);
      }
      await profileService.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        country: country.trim(),
      });
      await refreshUser();
      navigate("/onboarding/topics");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => navigate("/onboarding/topics");

  return (
    <div className="quizup-app bg-white min-h-[100dvh]">
      <div className="quizup-header-teal px-4 py-3 flex items-center justify-center shadow-sm">
        <h1 className="font-display font-bold text-white text-base">Profile Setup</h1>
      </div>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 py-8">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Step 1 of 2</p>
          <h2 className="text-2xl font-black text-foreground font-display">Tell the world who you are</h2>
        </div>

        {/* Avatar */}
        <div className="flex justify-center mb-8">
          <div 
            className="relative w-28 h-28 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden group shadow-md"
            onClick={() => fileInputRef.current?.click()}
          >
            <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-7 h-7 text-white" />
            </div>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Display Name *</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should others know you?"
              maxLength={32}
              className="h-12 bg-quizup-card border-border text-foreground"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A little about yourself..."
              maxLength={120}
              rows={3}
              className="w-full rounded-md px-3 py-2 text-sm border bg-quizup-card border-border text-foreground outline-none resize-none transition-all focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <p className="text-right text-[10px] font-bold mt-1 text-muted-foreground">{bio.length}/120</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block uppercase tracking-wider">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full h-12 rounded-md px-3 text-sm border bg-quizup-card border-border text-foreground outline-none cursor-pointer focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Select your country</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={handleContinue}
            disabled={saving}
            className="w-full h-14 rounded-lg quizup-header-green text-white font-display font-bold text-base disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</>
            ) : (
              <>Continue <ChevronRight className="h-5 w-5" /></>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full h-11 rounded-lg text-sm font-bold text-muted-foreground transition-opacity hover:opacity-70"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingProfile;
