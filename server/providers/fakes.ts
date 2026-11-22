import type { AiProvider } from "./ai";
import type { FileStorage } from "./storage";
import type { PaymentProvider, ChargeInput } from "./payments";
import type { LineSender, PushPayload, PushSender, PushSubscriptionRecord } from "./notify";

/**
 * In-memory fakes for tests. They record calls so assertions can check what
 * would have been sent to the external service. Never used in production.
 */
export function createFakeProviders() {
  const files = new Map<string, Buffer>();
  const charges: ChargeInput[] = [];
  const summaries: string[] = [];
  const pushes: Array<{ subscription: PushSubscriptionRecord; payload: PushPayload }> = [];
  const lines: Array<{ to: string; text: string }> = [];

  const storage: FileStorage = {
    async put(key, data) {
      files.set(key, data);
    },
    async get(key) {
      const data = files.get(key);
      if (!data) throw new Error("missing");
      return data;
    },
  };
  const payments: PaymentProvider = {
    async charge(input) {
      charges.push(input);
      return { id: `chrg_test_${charges.length}`, status: "successful" };
    },
  };
  const ai: AiProvider = {
    async summarize(text) {
      summaries.push(text);
      return `สรุป: ${text.slice(0, 20)}`;
    },
  };
  const push: PushSender = {
    async send(subscription, payload) {
      pushes.push({ subscription, payload });
    },
  };
  const line: LineSender = {
    async push(to, text) {
      lines.push({ to, text });
    },
  };

  return { storage, payments, ai, push, line, files, charges, summaries, pushes, lines };
}
