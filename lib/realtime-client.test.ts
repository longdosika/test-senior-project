import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectRealtime } from "./realtime-client";

/** Minimal stand-in for the browser WebSocket so the reconnect logic can be driven by hand. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  readonly url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

describe("realtime client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects to /ws, reports live status and forwards parsed messages", () => {
    const messages: unknown[] = [];
    const statuses: boolean[] = [];
    const stop = connectRealtime({ onMessage: (m) => messages.push(m), onStatus: (s) => statuses.push(s) });

    const socket = FakeSocket.instances[0];
    expect(socket.url).toMatch(/\/ws$/);
    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({ type: "task.created", data: { id: "t1" }, at: "now" }) });
    socket.onmessage?.({ data: "not json" }); // malformed frames are ignored, not thrown

    expect(statuses).toEqual([true]);
    expect(messages).toEqual([{ type: "task.created", data: { id: "t1" }, at: "now" }]);
    stop();
  });

  it("reconnects after a drop and stops retrying once cleaned up", () => {
    const statuses: boolean[] = [];
    const stop = connectRealtime({ onMessage: () => {}, onStatus: (s) => statuses.push(s), retryMs: 500 });

    FakeSocket.instances[0].onclose?.();
    expect(statuses).toEqual([false]);
    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);

    stop();
    expect(FakeSocket.instances[1].closed).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(2); // no reconnect after cleanup
  });
});
