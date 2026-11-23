import { useState, useEffect } from "react";
import type { WebsocketProvider } from "y-websocket";
import * as decoding from "lib0/decoding";

export interface SaveStatusState {
  type: "connecting" | "saving" | "saved" | "offline";
  text: string;
  timestampMs?: number;
}

export function formatSavedTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `Saved ${hours}:${minutes}`;
}

/**
 * Tracks collaboration save status per blueprint 4.8 & T6.7:
 * Four states:
 * 1. "Connecting"
 * 2. "Saving"
 * 3. "Saved HH:MM" (ONLY after server's type 4 message via provider.messageHandlers[4])
 * 4. "Offline. Your changes will sync when you reconnect."
 */
export function useSaveStatus(provider: WebsocketProvider | null | undefined): SaveStatusState {
  const [status, setStatus] = useState<SaveStatusState>({
    type: "connecting",
    text: "Connecting",
  });

  useEffect(() => {
    if (!provider) {
      setStatus({
        type: "connecting",
        text: "Connecting",
      });
      return;
    }

    const onOffline = () => {
      setStatus({
        type: "offline",
        text: "Offline. Your changes will sync when you reconnect.",
      });
    };

    const onOnline = () => {
      if (provider.wsconnected) {
        // Will be updated by server's type 4 message or keep connecting
      } else {
        setStatus({
          type: "connecting",
          text: "Connecting",
        });
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    const onStatusChange = (event: { status: "connecting" | "connected" | "disconnected" }) => {
      if (event.status === "disconnected") {
        setStatus({
          type: "offline",
          text: "Offline. Your changes will sync when you reconnect.",
        });
      } else if (event.status === "connecting") {
        setStatus({
          type: "connecting",
          text: "Connecting",
        });
      }
      // When "connected", we wait for the server's type 4 message to transition to "Saved HH:MM" or "Saving"
    };

    provider.on("status", onStatusChange);

    // Register message handler 4 for save status messages from server
    provider.messageHandlers[4] = (_encoder, decoder) => {
      const statusNum = decoding.readVarUint(decoder);
      const timestampMs = decoding.readVarUint(decoder);

      if (statusNum === 0) {
        setStatus({
          type: "saving",
          text: "Saving",
        });
      } else {
        const ts = timestampMs > 0 ? timestampMs : Date.now();
        setStatus({
          type: "saved",
          text: formatSavedTime(ts),
          timestampMs: ts,
        });
      }
    };

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      provider.off("status", onStatusChange);
      delete provider.messageHandlers[4];
    };
  }, [provider]);

  return status;
}
