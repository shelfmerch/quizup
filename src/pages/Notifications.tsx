import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MOCK_NOTIFICATIONS } from "@/data/mock-data";

const Notifications: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-quizup-dark">
      <div className="quizup-header-teal px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display font-bold text-foreground text-base">Notifications</h1>
      </div>

      <div className="p-4 space-y-2">
        {MOCK_NOTIFICATIONS.map((n) => (
          <div
            key={n.id}
            className={`bg-quizup-card rounded-lg p-4 ${!n.read ? "border-l-4" : ""}`}
            style={!n.read ? {borderLeftColor: 'hsl(152 69% 42%)'} : {}}
          >
            <p className="text-sm font-semibold text-foreground">{n.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
