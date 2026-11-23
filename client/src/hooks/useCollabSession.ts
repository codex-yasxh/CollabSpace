import { useState, useEffect } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export interface CollabSession {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}

/**
 * Manages the real-time Yjs document and WebsocketProvider lifecycle.
 * All resources are instantiated inside a single useEffect and fully torn down
 * on unmount or docId change, correctly handling React 18+ StrictMode.
 */
export function useCollabSession(docId: string | undefined): CollabSession | null {
  const [session, setSession] = useState<CollabSession | null>(null);

  useEffect(() => {
    if (!docId) {
      setSession(null);
      return;
    }

    const ydoc = new Y.Doc();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const base = `${protocol}//${host}/collab`;

    const provider = new WebsocketProvider(base, docId, ydoc);

    setSession({ ydoc, provider });

    return () => {
      setSession(null);
      try {
        provider.destroy();
      } catch {
        // ignore
      }
      try {
        ydoc.destroy();
      } catch {
        // ignore
      }
    };
  }, [docId]);

  return session;
}
