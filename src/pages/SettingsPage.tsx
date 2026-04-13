import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const items = [
    "Edit Profile",
    "Notifications", 
    "Sound Effects",
    "Privacy Policy",
    "Terms of Service",
    "About",
  ];

  return (
    <div className="min-h-screen bg-quizup-dark">
      <div className="quizup-header-teal px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-foreground text-base">Settings</h1>
      </div>

      <div className="p-4 space-y-2">
        {user?.role === "admin" && (
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="w-full text-left py-4 px-4 bg-quizup-card rounded-lg text-quizup-gold text-sm font-display font-bold border border-quizup-gold/30"
          >
            Quiz admin — topics and questions
          </button>
        )}
        {items.map((label) => (
          <button
            key={label}
            className="w-full text-left py-4 px-4 bg-quizup-card rounded-lg text-foreground text-sm font-medium"
          >
            {label}
          </button>
        ))}

        <button
          onClick={async () => { await logout(); navigate("/"); }}
          className="w-full text-left py-4 px-4 bg-quizup-card rounded-lg text-quizup-red text-sm font-semibold mt-4"
        >
          Log Out
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
