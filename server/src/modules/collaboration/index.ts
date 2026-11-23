import type { Server as HttpServer } from "node:http";
import { createCollaborationServer } from "./wsServer.js";

export function setupCollaboration(server: HttpServer) {
  const { wss, handleUpgrade } = createCollaborationServer();

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/collab")) {
      void handleUpgrade(req, socket, head);
    }
  });

  return { wss, handleUpgrade };
}

export * from "./wsServer.js";
export * from "./rooms.js";
