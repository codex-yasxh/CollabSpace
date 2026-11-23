import type { Server as HttpServer } from "node:http";
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

  wss.on("connection", async (ws, _req, context: AuthenticatedConnectionContext) => {
    try {
      const room = await roomManager.getRoom(context.documentId);
      attachConnection(room, {
        ws,
        user: context.user,
        role: context.role,
        awarenessIds: new Set(),
      });
    } catch {
      try {
        ws.close(1011, "Internal server error");
      } catch {
        // ignore
      }
    }
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
