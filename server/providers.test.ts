import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnthropicAiProvider } from "./providers/ai";
import { ProviderError, ProviderNotConfiguredError } from "./providers/errors";
import { OmisePaymentProvider } from "./providers/payments";
import { LineMessagingSender, WebPushSender } from "./providers/notify";
import { LocalFileStorage } from "./providers/storage";
import { createDeps, loadConfig } from "./container";
import { createTestApp } from "./testing/harness";
import { noopEvents } from "./realtime";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Omise payment adapter", () => {
  it("posts the charge with Basic auth and maps the status", async () => {
    const fetchMock = vi.fn(async () => json({ id: "chrg_1", status: "successful" }));
    const omise = new OmisePaymentProvider({ secretKey: "skey_test", fetch: fetchMock });
    const result = await omise.charge({
      amountSatang: 20000,
      currency: "THB",
      token: "tokn_1",
      description: "d",
      metadata: { userId: "u1" },
    });
    expect(result).toEqual({ id: "chrg_1", status: "successful" });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.omise.co/charges");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("skey_test:").toString("base64")}`,
    );
    expect(JSON.parse(init.body as string)).toMatchObject({ amount: 20000, card: "tokn_1", currency: "THB" });
  });

  it("throws ProviderError when Omise rejects the request", async () => {
    const omise = new OmisePaymentProvider({
      secretKey: "skey_test",
      fetch: async () => json({ message: "invalid card" }, 400),
    });
    await expect(
      omise.charge({ amountSatang: 2000, currency: "THB", token: "bad", description: "d", metadata: {} }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("Anthropic AI adapter", () => {
  it("sends the messages request and joins the text blocks", async () => {
    const fetchMock = vi.fn(async () => json({ content: [{ type: "text", text: "สรุป" }, { type: "text", text: "สั้น" }] }));
    const ai = new AnthropicAiProvider({ apiKey: "sk-test", model: "claude-haiku-5-5", fetch: fetchMock });
    expect(await ai.summarize("ข้อความ")).toBe("สรุปสั้น");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-test");
    expect(JSON.parse(init.body as string).model).toBe("claude-haiku-5-5");
  });

  it("raises ProviderError on upstream failure", async () => {
    const ai = new AnthropicAiProvider({
      apiKey: "sk-test",
      model: "m",
      fetch: async () => json({ error: { message: "overloaded" } }, 529),
    });
    await expect(ai.summarize("x")).rejects.toThrow("overloaded");
  });
});

describe("LINE and Web Push adapters", () => {
  it("sends LINE push messages with a bearer token", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const line = new LineMessagingSender({ accessToken: "line-token", fetch: fetchMock });
    await line.push("Uabc", "hello");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.line.me/v2/bot/message/push");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer line-token");
    expect(JSON.parse(init.body as string).messages[0]).toEqual({ type: "text", text: "hello" });
  });

  it("fails LINE pushes with a non-2xx status", async () => {
    const line = new LineMessagingSender({ accessToken: "t", fetch: async () => new Response("", { status: 401 }) });
    await expect(line.push("U", "x")).rejects.toThrow("HTTP 401");
  });

  it("delivers Web Push payloads through the web-push client", async () => {
    const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
    const sender = new WebPushSender({
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:x@example.com",
      client: { sendNotification } as never,
    });
    await sender.send({ endpoint: "https://push.example.test/1", p256dh: "p", auth: "a" }, { title: "t", body: "b" });
    const [sub, payload] = sendNotification.mock.calls[0] as unknown as [{ endpoint: string }, string];
    expect(sub.endpoint).toBe("https://push.example.test/1");
    expect(JSON.parse(payload)).toEqual({ title: "t", body: "b" });
  });
});

describe("configuration without API keys", () => {
  it("reports missing keys as not configured instead of faking success", async () => {
    const { db } = await createTestApp();
    const deps = createDeps({ db, config: loadConfig({}), events: noopEvents });
    await expect(
      deps.payments.charge({ amountSatang: 2000, currency: "THB", token: "t", description: "d", metadata: {} }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
    await expect(deps.ai.summarize("x")).rejects.toBeInstanceOf(ProviderNotConfiguredError);
    await expect(deps.line.push("U", "x")).rejects.toBeInstanceOf(ProviderNotConfiguredError);
    await expect(
      deps.push.send({ endpoint: "https://e.test", p256dh: "p", auth: "a" }, { title: "t", body: "b" }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it("reads keys only from the environment", () => {
    const config = loadConfig({ OMISE_SECRET_KEY: "skey_x", ADMIN_EMAILS: " A@x.com, b@y.com ," });
    expect(config.omiseSecretKey).toBe("skey_x");
    expect(config.adminEmails).toEqual(["a@x.com", "b@y.com"]);
    expect(config.anthropicModel).toBe("claude-haiku-5-5");
  });
});

describe("local file storage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "sp-storage-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips bytes and rejects path-like keys", async () => {
    const storage = new LocalFileStorage(dir);
    await storage.put("abc-123", Buffer.from("data"));
    expect((await storage.get("abc-123")).toString()).toBe("data");
    await expect(storage.put("../escape", Buffer.from("x"))).rejects.toThrow("invalid storage key");
  });
});
