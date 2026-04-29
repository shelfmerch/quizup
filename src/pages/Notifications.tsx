import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MOCK_NOTIFICATIONS } from "@/data/mock-data";

const Notifications: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center gap-3 border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-slate-900 text-base">Notifications</h1>
      </div>

      <div className="p-4 space-y-2">
        {MOCK_NOTIFICATIONS.map((n) => (
          <div
            key={n.id}
            className={`bg-white border border-slate-100 rounded-xl p-4 shadow-sm ${!n.read ? "border-l-4" : ""}`}
            style={!n.read ? {borderLeftColor: 'hsl(152 69% 42%)'} : {}}
          >
            <p className="text-sm font-semibold text-slate-900">{n.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
