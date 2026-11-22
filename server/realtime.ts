import type { Server } from "node:http";
import { WebSocketServer } from "ws";

export type RealtimeEvent = { type: string; data: unknown };

export interface EventPublisher {
  publish(event: RealtimeEvent): void;
}

export const noopEvents: EventPublisher = { publish() {} };

/**
 * Attaches a WebSocket server on `/ws` to the HTTP server. Every published event
 * is broadcast as JSON: { type, data, at } to all connected clients.
 */
export function attachRealtime(server: Server): EventPublisher & {
  clientCount(): number;
  close(): Promise<void>;
} {
  const wss = new WebSocketServer({ server, path: "/ws" });
  return {
    publish(event) {
      const message = JSON.stringify({ ...event, at: new Date().toISOString() });
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(message);
      }
    },
    clientCount() {
      return wss.clients.size;
    },
    close() {
      return new Promise((resolve, reject) => {
        for (const client of wss.clients) client.terminate();
        wss.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
