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
    <div className="min-h-screen">
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center gap-3 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-slate-900 text-base">Settings</h1>
      </div>

      <div className="p-4 space-y-2">
        {user?.role === "admin" && (
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="w-full text-left py-4 px-4 bg-white rounded-xl text-quizup-gold text-sm font-display font-bold border border-quizup-gold/30 shadow-sm"
          >
            Quiz admin — topics and questions
          </button>
        )}
        {items.map((label) => (
          <button
            key={label}
            className="w-full text-left py-4 px-4 bg-white border border-slate-100 rounded-xl text-slate-900 text-sm font-medium shadow-sm"
          >
            {label}
          </button>
        ))}

        <button
          onClick={async () => { await logout(); navigate("/"); }}
          className="w-full text-left py-4 px-4 bg-white border border-slate-100 rounded-xl text-quizup-red text-sm font-semibold mt-4 shadow-sm"
        >
          Log Out
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
