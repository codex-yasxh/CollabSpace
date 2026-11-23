import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { findById, type User } from "../users/userRepository.js";
import { resolveRole, type DocumentRole } from "../access/resolveRole.js";
import { getDocumentById } from "../documents/documentRepository.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthenticatedConnectionContext {
  documentId: string;
  user: User;
  role: DocumentRole;
}

export function rejectUpgrade(
  socket: Duplex,
  statusCode: number,
  statusText: string,
): void {
  socket.write(
    `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${statusText}`,
  );
  socket.destroy();
}

export function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function createCollaborationServer() {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2 * 1024 * 1024, // 2MB
  });

  const handleUpgrade = async (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> => {
    try {
      const urlString = req.url || "";
      const pathname = urlString.split("?")[0]!;

      // Match /collab/:documentId path
      const match = pathname.match(/^\/collab\/([^/]+)$/);
      if (!match) {
        rejectUpgrade(socket, 404, "Not Found");
        return;
      }

      const documentId = match[1]!;

      // 1. UUID shape check
      if (!UUID_REGEX.test(documentId)) {
        rejectUpgrade(socket, 400, "Bad Request");
        return;
      }

      // 2. Origin header in ALLOWED_ORIGINS
      const origin = req.headers.origin;
      if (!origin || !env.ALLOWED_ORIGINS.includes(origin)) {
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }

      // 3. Cookie contains valid JWT
      const token = parseCookie(req.headers.cookie, "cs_session");
      if (!token) {
        rejectUpgrade(socket, 401, "Unauthorized");
        return;
      }

      let userId: string;
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
        if (!decoded || typeof decoded.sub !== "string" || !decoded.sub) {
          rejectUpgrade(socket, 401, "Unauthorized");
          return;
        }
        userId = decoded.sub;
      } catch {
        rejectUpgrade(socket, 401, "Unauthorized");
        return;
      }

      const user = await findById(userId);
      if (!user) {
        rejectUpgrade(socket, 401, "Unauthorized");
        return;
      }

      // 4. Document exists
      const doc = await getDocumentById(documentId);
      if (!doc) {
        rejectUpgrade(socket, 404, "Not Found");
        return;
      }

      // 5. resolveRole (reuse existing function)
      const role = await resolveRole(user.id, documentId);
      if (!role) {
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }

      // Upgrade to WebSocket
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const context: AuthenticatedConnectionContext = { documentId, user, role };
        wss.emit("connection", ws, req, context);
      });
    } catch {
      rejectUpgrade(socket, 500, "Internal Server Error");
    }
  };

  return { wss, handleUpgrade };
}
