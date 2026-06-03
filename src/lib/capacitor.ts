import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";

/**
 * Returns true when the app is running natively (Android / iOS).
 * Returns false in a normal web browser.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Initialise the Android status bar.
 * Safe to call on web (no-ops automatically via Capacitor).
 */
export async function initStatusBar(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#f65357" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // StatusBar plugin unavailable — ignore
  }
}

/**
 * Hide the native splash screen after the React app has mounted.
 * A short fade delay prevents a flash of unstyled content.
 */
export async function initSplashScreen(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {
    // SplashScreen plugin unavailable — ignore
  }
}

/**
 * Listen for network connectivity changes.
 * @param onOnline  Called when the device goes online.
 * @param onOffline Called when the device goes offline.
 * @returns Cleanup function — call on unmount.
 */
export function setupNetworkMonitor(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (!isNativePlatform()) {
    // On web, fall back to browser events
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }

  let pluginHandle: { remove: () => void } | null = null;

  Network.addListener("networkStatusChange", (status) => {
    if (status.connected) {
      onOnline();
    } else {
      onOffline();
    }
  }).then((handle) => {
    pluginHandle = handle;
  });

  return () => {
    pluginHandle?.remove();
  };
}

/**
 * Listen for app pause / resume lifecycle events.
 * @param onPause  Called when the app goes to background.
 * @param onResume Called when the app returns to foreground.
 * @returns Cleanup function — call on unmount.
 */
export function setupAppLifecycle(
  onPause: () => void,
  onResume: () => void
): () => void {
  if (!isNativePlatform()) {
    // On web, use visibilitychange as a fallback
    const handler = () => {
      if (document.hidden) {
        onPause();
      } else {
        onResume();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }

  let pluginHandle: { remove: () => void } | null = null;

  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      onResume();
    } else {
      onPause();
    }
  }).then((handle) => {
    pluginHandle = handle;
  });

  return () => {
    pluginHandle?.remove();
  };
}

/**
 * Register the Android hardware back button handler.
 * @param onBack  Custom handler — return true to mark as handled (prevents default).
 *                Return false / undefined to let Capacitor handle it (closes the app).
 * @returns Cleanup function.
 */
export function registerBackButtonHandler(
  onBack: () => boolean | void
): () => void {
  if (!isNativePlatform()) return () => {};

  let pluginHandle: { remove: () => void } | null = null;

  App.addListener("backButton", () => {
    onBack();
  }).then((handle) => {
    pluginHandle = handle;
  });

  return () => {
    pluginHandle?.remove();
  };
}

/**
 * Minimise the app to background (Android back-button on root screen).
 */
export function minimizeApp(): void {
  if (!isNativePlatform()) return;
  App.minimizeApp().catch(() => {});
}
