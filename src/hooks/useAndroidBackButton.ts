import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { registerBackButtonHandler, minimizeApp } from "@/lib/capacitor";

/**
 * Handles the Android hardware back button inside the React Router context.
 *
 * Behaviour:
 *  - At the root route "/" → minimise the app (standard Android behaviour).
 *  - On any other route → navigate(-1) like the browser back button.
 *  - On the /battle route → does nothing (let BattlePage manage its own
 *    exit-confirm dialog via its own handler or the default back behaviour).
 *
 * Mount this component once inside the Router so it has access to navigation hooks.
 */
const useAndroidBackButton = (): void => {
  const navigate = useNavigate();
  const location = useLocation();

  // Keep a stable ref so the registered callback always reads the latest pathname
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useEffect(() => {
    const cleanup = registerBackButtonHandler(() => {
      const path = pathnameRef.current;

      // Root screen — minimise instead of exiting
      if (path === "/" || path === "") {
        minimizeApp();
        return;
      }

      // Battle page — let BattlePage handle the back button itself
      if (path === "/battle") {
        return;
      }

      // All other routes — go back
      navigate(-1);
    });

    return cleanup;
  }, [navigate]); // navigate is stable across renders
};

export default useAndroidBackButton;
