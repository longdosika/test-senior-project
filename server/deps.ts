import type { Pool } from "pg";
import type { AiProvider } from "./providers/ai";
import type { FileStorage } from "./providers/storage";
import type { PaymentProvider } from "./providers/payments";
import type { LineSender, PushSender } from "./providers/notify";
import type { EventPublisher } from "./realtime";

/** Everything the Express app needs. Tests pass fakes; production uses `createDeps`. */
export type AppDeps = {
  db: Pool;
  adminEmails: string[];
  corsOrigin: string;
  storage: FileStorage;
  payments: PaymentProvider;
  ai: AiProvider;
  push: PushSender;
  line: LineSender;
  events: EventPublisher;
  now?: () => Date;
};
