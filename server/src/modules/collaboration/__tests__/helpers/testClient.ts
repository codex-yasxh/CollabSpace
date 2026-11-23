import { WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import { MSG_SYNC, MSG_AWARENESS, MSG_SAVE } from "../../protocol.js";

export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 25,
  description: string = "condition",
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  if (await predicate()) {
    return;
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms waiting for: ${description}`);
}

export interface TestClientOptions {
  url: string;
  cookie: string;
  origin?: string;
}

export class TestClient {
  public ws!: WebSocket;
  public doc: Y.Doc;
  public awareness: awarenessProtocol.Awareness;
  public isConnected: boolean = false;
  public closeCode: number | null = null;
  public closeReason: string | null = null;
  public receivedSaveStatuses: { status: number; timestamp: number }[] = [];

  constructor(doc?: Y.Doc) {
    this.doc = doc ?? new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Listen to local doc updates and broadcast to server (origin !== "remote")
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== "remote" && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.writeUpdate(encoder, update);
        this.ws.send(encoding.toUint8Array(encoder));
      }
    });
  }

  static async connect(options: TestClientOptions, doc?: Y.Doc): Promise<TestClient> {
    const client = new TestClient(doc);
    await client.open(options);
    return client;
  }

  open(options: TestClientOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(options.url, {
        headers: {
          Origin: options.origin ?? "http://localhost:5173",
          Cookie: options.cookie,
        },
      });

      this.ws.on("open", () => {
        this.isConnected = true;

        // Step 1: Send client's sync step 1 so server replies with step 2
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.writeSyncStep1(encoder, this.doc);
        this.ws.send(encoding.toUint8Array(encoder));

        resolve();
      });

      this.ws.on("message", (data: unknown) => {
        let bytes: Uint8Array;
        if (Buffer.isBuffer(data)) {
          bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else {
          bytes = new Uint8Array(Buffer.from(data as string));
        }

        try {
          const decoder = decoding.createDecoder(bytes);
          const messageType = decoding.readVarUint(decoder);

          if (messageType === MSG_SYNC) {
            const replyEncoder = encoding.createEncoder();
            encoding.writeVarUint(replyEncoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, replyEncoder, this.doc, "remote");
            if (encoding.length(replyEncoder) > 1 && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(encoding.toUint8Array(replyEncoder));
            }
          } else if (messageType === MSG_AWARENESS) {
            awarenessProtocol.applyAwarenessUpdate(
              this.awareness,
              decoding.readVarUint8Array(decoder),
              "remote",
            );
          } else if (messageType === MSG_SAVE) {
            const status = decoding.readVarUint(decoder);
            const timestamp = decoding.readVarUint(decoder);
            this.receivedSaveStatuses.push({ status, timestamp });
          }
        } catch {
          // ignore parsing error
        }
      });

      this.ws.on("close", (code, reason) => {
        this.isConnected = false;
        this.closeCode = code;
        this.closeReason = reason.toString();
      });

      this.ws.on("error", (err) => {
        if (!this.isConnected) {
          reject(err);
        }
      });
    });
  }

  getText(field: string = "default"): string {
    return this.doc.getText(field).toString();
  }

  insertText(index: number, text: string, field: string = "default"): void {
    this.doc.getText(field).insert(index, text);
  }

  deleteText(index: number, length: number, field: string = "default"): void {
    this.doc.getText(field).delete(index, length);
  }

  forceSendUpdate(bytes: Uint8Array): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, bytes);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }

  destroy(): void {
    this.close();
    this.awareness.destroy();
    this.doc.destroy();
  }
}
