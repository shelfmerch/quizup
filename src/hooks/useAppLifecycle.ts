import { useEffect } from "react";
import { setupAppLifecycle, setupNetworkMonitor } from "@/lib/capacitor";
import { onResumeReconnect } from "@/services/socketService";

/**
 * Monitors app lifecycle (pause / resume) and network status.
 *
 * On resume:
 *  - Calls onResumeReconnect() to force-reconnect the Socket.IO socket if
 *    it was disconnected while the app was in the background.
 *
 * On network recovery:
 *  - Same reconnect call, since going offline also drops the socket.
 *
 * Mount this hook once at the AuthProvider level so it is active for
 * the entire authenticated session.
 */
export function useAppLifecycle(): void {
  useEffect(() => {
    const cleanupLifecycle = setupAppLifecycle(
      /* onPause */ () => {
        // Nothing to do on pause — socket.io handles disconnection internally
      },
      /* onResume */ () => {
        // App came back to foreground — reconnect socket if needed
        onResumeReconnect();
      }
    );

    const cleanupNetwork = setupNetworkMonitor(
      /* onOnline */ () => {
        // Network recovered — reconnect socket
        onResumeReconnect();
      },
      /* onOffline */ () => {
        // Network lost — socket will disconnect on its own
      }
    );

    return () => {
      cleanupLifecycle();
      cleanupNetwork();
    };
  }, []);
}
