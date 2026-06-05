import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quizup.app",
  appName: "QuizUp",
  webDir: "dist",
  server: {
    // androidScheme tells the WebView to use https:// internally so that
    // cookies, localStorage and mixed-content rules all work correctly.
    androidScheme: "https",
  },
  android: {
    // Allow the WebView to load resources over cleartext HTTP during dev.
    // In production the backend is HTTPS so this only matters locally.
    allowMixedContent: false,
    // Capture clicks on web links inside the app instead of opening the browser.
    captureInput: true,
    // Enable chrome://inspect while developing (set false before Play Store release).
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      // Hide automatically once the app is ready (we call hide() in main.tsx)
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: "#f65357",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#f65357",
    },
  },
};

export default config;
