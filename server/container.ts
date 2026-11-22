import path from "node:path";
import { Pool } from "pg";
import type { AppDeps } from "./deps";
import { AnthropicAiProvider, type AiProvider } from "./providers/ai";
import { ProviderNotConfiguredError } from "./providers/errors";
import { OmisePaymentProvider, type PaymentProvider } from "./providers/payments";
import { LineMessagingSender, WebPushSender, type LineSender, type PushSender } from "./providers/notify";
import { LocalFileStorage, type FileStorage } from "./providers/storage";
import { noopEvents, type EventPublisher } from "./realtime";

/** Reads configuration from environment variables. Secrets are never stored in the repo. */
export type AppConfig = {
  databaseUrl: string | undefined;
  port: number;
  corsOrigin: string;
  adminEmails: string[];
  uploadDir: string;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  omiseSecretKey: string | undefined;
  lineChannelAccessToken: string | undefined;
  vapidPublicKey: string | undefined;
  vapidPrivateKey: string | undefined;
  vapidSubject: string;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    databaseUrl: env.DATABASE_URL || undefined,
    port: Number(env.PORT ?? 4000),
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:3000",
    adminEmails: (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    uploadDir: env.UPLOAD_DIR ?? path.resolve(process.cwd(), "uploads"),
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
    omiseSecretKey: env.OMISE_SECRET_KEY || undefined,
    lineChannelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN || undefined,
    vapidPublicKey: env.VAPID_PUBLIC_KEY || undefined,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY || undefined,
    vapidSubject: env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  };
}

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

/** Builds production dependencies. A provider without its key returns 503 instead of faking success. */
export function createDeps(opts: { db: Pool; config: AppConfig; events?: EventPublisher }): AppDeps {
  const { config } = opts;
  const notConfigured = (name: string) => ({
    fail(): never {
      throw new ProviderNotConfiguredError(name);
    },
  });

  const payments: PaymentProvider = config.omiseSecretKey
    ? new OmisePaymentProvider({ secretKey: config.omiseSecretKey })
    : { charge: async () => notConfigured("Omise").fail() };

  const ai: AiProvider = config.anthropicApiKey
    ? new AnthropicAiProvider({ apiKey: config.anthropicApiKey, model: config.anthropicModel })
    : { summarize: async () => notConfigured("Anthropic").fail() };

  const line: LineSender = config.lineChannelAccessToken
    ? new LineMessagingSender({ accessToken: config.lineChannelAccessToken })
    : { push: async () => notConfigured("LINE").fail() };

  const push: PushSender =
    config.vapidPublicKey && config.vapidPrivateKey
      ? new WebPushSender({
          publicKey: config.vapidPublicKey,
          privateKey: config.vapidPrivateKey,
          subject: config.vapidSubject,
        })
      : { send: async () => notConfigured("Web Push (VAPID)").fail() };

  const storage: FileStorage = new LocalFileStorage(config.uploadDir);

  return {
    db: opts.db,
    adminEmails: config.adminEmails,
    corsOrigin: config.corsOrigin,
    storage,
    payments,
    ai,
    push,
    line,
    events: opts.events ?? noopEvents,
  };
}
