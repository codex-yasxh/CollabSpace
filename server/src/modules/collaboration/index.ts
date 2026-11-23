import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import { createCollaborationServer, type AuthenticatedConnectionContext } from "./wsServer.js";
import { roomManager } from "./roomManager.js";
import { attachConnection } from "./protocol.js";

export function setupCollaboration(server: HttpServer) {
  const { wss, handleUpgrade } = createCollaborationServer();

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/collab")) {
      void handleUpgrade(req, socket, head);
    }
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, context: AuthenticatedConnectionContext) => {
    // Buffer any incoming messages that arrive before async Room.load completes
    const earlyMessages: unknown[] = [];
    const onEarlyMessage = (data: unknown) => {
      earlyMessages.push(data);
    };
    ws.on("message", onEarlyMessage);

    void roomManager
      .getRoom(context.documentId)
      .then((room) => {
        ws.off("message", onEarlyMessage);
        const conn = {
          ws,
          user: context.user,
          role: context.role,
          awarenessIds: new Set<number>(),
        };
        attachConnection(room, conn);

        // Replay any early messages buffered while room was loading from DB
        for (const data of earlyMessages) {
          ws.emit("message", data);
        }
      })
      .catch(() => {
        try {
          ws.close(1011, "Internal server error");
        } catch {
          // ignore
        }
      });
  });

  // Flush all active rooms on process termination
  const onSignal = () => {
    void roomManager.flushAllRooms();
  };
  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);

  return { wss, handleUpgrade, roomManager };
}

export * from "./wsServer.js";
export * from "./rooms.js";
export * from "./room.js";
export * from "./roomManager.js";
export * from "./protocol.js";
