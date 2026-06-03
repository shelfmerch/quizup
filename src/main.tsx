import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initStatusBar, initSplashScreen } from "@/lib/capacitor";

createRoot(document.getElementById("root")!).render(<App />);

// Initialise Android UI details and hide splash screen
initStatusBar();
initSplashScreen();
