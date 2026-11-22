import { realtimeUrl } from "./api-client";

export type RealtimeMessage = { type: string; data: unknown; at: string };

/**
 * Keeps a WebSocket open to the API and reconnects after drops.
 * Returns a cleanup function that closes the socket and stops reconnecting.
 */
export function connectRealtime(opts: {
  onMessage: (message: RealtimeMessage) => void;
  onStatus?: (live: boolean) => void;
  retryMs?: number;
}): () => void {
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const retryMs = opts.retryMs ?? 3000;

  const open = () => {
    if (closed) return;
    try {
      socket = new WebSocket(realtimeUrl());
    } catch {
      opts.onStatus?.(false);
      retryTimer = setTimeout(open, retryMs);
      return;
    }
    socket.onopen = () => opts.onStatus?.(true);
    socket.onmessage = (event) => {
      try {
        opts.onMessage(JSON.parse(String(event.data)) as RealtimeMessage);
      } catch {
        // ignore malformed frames
      }
    };
    socket.onclose = () => {
      opts.onStatus?.(false);
      if (!closed) retryTimer = setTimeout(open, retryMs);
    };
  };

  open();
  return () => {
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
