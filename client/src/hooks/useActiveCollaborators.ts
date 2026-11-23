import { useState, useEffect } from "react";
import type { WebsocketProvider } from "y-websocket";
import type { CollaboratorUser } from "../components/ui/AvatarStack.js";
import { getPresenceColor } from "../lib/presence.js";

/**
 * Tracks active collaborators from the awareness protocol.
 * - Subscribes to awareness 'change' events.
 * - Deduplicates by userId.
 * - Places current user first.
 * - Throttles updates to at most once per animation frame.
 * - Fully unbinds on effect cleanup.
 */
export function useActiveCollaborators(
  provider: WebsocketProvider | null | undefined,
  currentUserId?: string,
): CollaboratorUser[] {
  const [users, setUsers] = useState<CollaboratorUser[]>([]);

  useEffect(() => {
    if (!provider || !provider.awareness) {
      setUsers([]);
      return;
    }

    const awareness = provider.awareness;
    let frameId: number | null = null;

    const computeUsers = () => {
      const states = Array.from(awareness.getStates().values());
      const map = new Map<string, CollaboratorUser>();

      for (const state of states) {
        if (!state || typeof state !== "object") continue;
        const u = (state as Record<string, unknown>).user;
        if (!u || typeof u !== "object") continue;

        const userObj = u as Record<string, unknown>;
        const userId = typeof userObj.userId === "string" ? userObj.userId : undefined;
        const name = typeof userObj.name === "string" ? userObj.name : "Anonymous";

        if (!userId) continue;

        if (!map.has(userId)) {
          const color = getPresenceColor(userId);
          map.set(userId, {
            id: userId,
            name,
            presenceColor: color.name,
            isCurrentUser: userId === currentUserId,
          });
        }
      }

      // Sort: current user first, then by name
      const list = Array.from(map.values()).sort((a, b) => {
        if (a.isCurrentUser) return -1;
        if (b.isCurrentUser) return 1;
        return a.name.localeCompare(b.name);
      });

      setUsers(list);
    };

    const onAwarenessChange = () => {
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        computeUsers();
      });
    };

    // Initial computation
    computeUsers();

    awareness.on("change", onAwarenessChange);

    return () => {
      awareness.off("change", onAwarenessChange);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [provider, currentUserId]);

  return users;
}
