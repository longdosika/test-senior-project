import { ProviderError } from "./errors";

export type ChargeInput = {
  amountSatang: number;
  currency: "THB";
  /** Card token created on the client with Omise.js (never raw card data). */
  token: string;
  description: string;
  metadata: Record<string, string>;
};

export type ChargeResult = {
  id: string;
  status: "successful" | "pending" | "failed";
};

export interface PaymentProvider {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Omise (https://www.omise.co) charge API adapter. Requires OMISE_SECRET_KEY. */
export class OmisePaymentProvider implements PaymentProvider {
  private readonly secretKey: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: { secretKey: string; fetch?: FetchLike }) {
    this.secretKey = opts.secretKey;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const res = await this.fetchImpl("https://api.omise.co/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: input.amountSatang,
        currency: input.currency,
        card: input.token,
        description: input.description,
        metadata: input.metadata,
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { id?: string; status?: string; message?: string }
      | null;
    if (!res.ok || !json?.id) {
      throw new ProviderError(`Omise charge failed: ${json?.message ?? `HTTP ${res.status}`}`);
    }
    const status = json.status === "successful" || json.status === "failed" ? json.status : "pending";
    return { id: json.id, status };
  }
}
