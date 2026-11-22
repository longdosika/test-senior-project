import * as webpush from "web-push";
import { ProviderError } from "./errors";

export type PushSubscriptionRecord = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string };

export interface PushSender {
  send(subscription: PushSubscriptionRecord, payload: PushPayload): Promise<void>;
}

/** Web Push (VAPID) adapter using the `web-push` package. */
export class WebPushSender implements PushSender {
  private readonly client: Pick<typeof webpush, "sendNotification">;

  constructor(opts: {
    publicKey: string;
    privateKey: string;
    subject: string;
    client?: Pick<typeof webpush, "sendNotification">;
  }) {
    if (!opts.client) webpush.setVapidDetails(opts.subject, opts.publicKey, opts.privateKey);
    this.client = opts.client ?? webpush;
  }

  async send(subscription: PushSubscriptionRecord, payload: PushPayload): Promise<void> {
    try {
      await this.client.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
      );
    } catch (err) {
      throw new ProviderError(`Web Push failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export interface LineSender {
  push(to: string, text: string): Promise<void>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** LINE Messaging API push-message adapter. Requires LINE_CHANNEL_ACCESS_TOKEN. */
export class LineMessagingSender implements LineSender {
  private readonly accessToken: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: { accessToken: string; fetch?: FetchLike }) {
    this.accessToken = opts.accessToken;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  async push(to: string, text: string): Promise<void> {
    const res = await this.fetchImpl("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
    });
    if (!res.ok) throw new ProviderError(`LINE push failed: HTTP ${res.status}`);
  }
}
