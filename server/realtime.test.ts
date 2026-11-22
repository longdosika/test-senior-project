import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { attachRealtime } from "./realtime";
import { createTestApp } from "./testing/harness";

function nextMessage(ws: WebSocket): Promise<{ type: string; data: unknown }> {
  return new Promise((resolve, reject) => {
    ws.once("message", (raw) => resolve(JSON.parse(raw.toString())));
    ws.once("error", reject);
  });
}

describe("realtime updates over WebSocket", () => {
  let server: Server | undefined;
  let realtime: ReturnType<typeof attachRealtime> | undefined;
  let sockets: WebSocket[] = [];
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    for (const ws of sockets) ws.terminate();
    sockets = [];
    await realtime?.close();
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    await close?.();
    server = undefined;
    realtime = undefined;
  });

  it("pushes task changes to connected clients in real time", async () => {
    const ctx = await createTestApp();
    close = () => ctx.close();
    // The HTTP request path publishes through the same realtime instance the WebSocket serves.
    const httpServer = createServer();
    server = httpServer;
    realtime = attachRealtime(httpServer);
    httpServer.on("request", createApp({ ...ctx.deps, events: realtime }));
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    const { port } = httpServer.address() as AddressInfo;

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once("open", () => resolve());
      ws.once("error", reject);
    });
    expect(realtime.clientCount()).toBe(1);

    const received = nextMessage(ws);
    const reg = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "live@example.com", password: "correct-horse-battery", displayName: "Live" }),
    });
    // The session arrives as an httpOnly cookie; send it back the way a browser would.
    const cookie = (reg.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie.startsWith("sp_session=")).toBe(true);
    await fetch(`http://127.0.0.1:${port}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: "Live task" }),
    });

    const message = await received;
    expect(message.type).toBe("task.created");
    expect(message.data).toMatchObject({ title: "Live task" });
  });
});
