import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/services/socketService";

/**
 * Tracks online/offline presence for a set of user IDs via Socket.io.
 *
 * Usage:
 *   const { isOnline } = useOnlineStatus(["userId1", "userId2"]);
 *   if (isOnline("userId1")) { ... }
 *
 * Or for a single user:
 *   const { isOnline } = useOnlineStatus(peerId);
 */
export function useOnlineStatus(
  userIds: string | string[] | undefined | null
): { onlineMap: Record<string, boolean>; isOnline: (id: string) => boolean } {
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const idsRef = useRef<string[]>([]);

  // Normalise to array
  const ids =
    userIds == null
      ? []
      : typeof userIds === "string"
      ? userIds
        ? [userIds]
        : []
      : userIds.filter(Boolean);

  // Keep a stable ref of the latest ids so event handlers can read them
  idsRef.current = ids;

  const isOnline = useCallback(
    (id: string) => !!onlineMap[id],
    [onlineMap]
  );

  useEffect(() => {
    if (ids.length === 0) return;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return; // not authenticated
    }

    // Ask server for current status
    socket.emit("presence:check", { userIds: ids });

    const handleStatus = (status: Record<string, boolean>) => {
      setOnlineMap((prev) => {
        // Only update keys that we care about
        const next = { ...prev };
        for (const id of idsRef.current) {
          if (id in status) next[id] = status[id];
        }
        return next;
      });
    };

    const handleOnline = ({ userId }: { userId: string }) => {
      setOnlineMap((prev) => {
        if (prev[userId]) return prev; // already online
        return { ...prev, [userId]: true };
      });
    };

    const handleOffline = ({ userId }: { userId: string }) => {
      setOnlineMap((prev) => {
        if (!prev[userId]) return prev; // already offline
        return { ...prev, [userId]: false };
      });
    };

    socket.on("presence:status", handleStatus);
    socket.on("presence:online", handleOnline);
    socket.on("presence:offline", handleOffline);

    return () => {
      socket.off("presence:status", handleStatus);
      socket.off("presence:online", handleOnline);
      socket.off("presence:offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  return { onlineMap, isOnline };
}
