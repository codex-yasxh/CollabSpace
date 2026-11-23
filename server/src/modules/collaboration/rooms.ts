import { roomManager } from "./roomManager.js";

export const rooms = {
  closeAllConnections: (
    docId: string,
    code: number = 4403,
    reason: string = "Access changed",
  ): void => {
    void roomManager.closeAllConnections(docId, code, reason);
  },
  evictRoomOnDelete: (docId: string): void => {
    void roomManager.evictRoomOnDelete(docId);
  },
};
