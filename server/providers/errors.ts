/** Thrown when an external service has no API key configured. Maps to HTTP 503. */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured (missing API key)`);
    this.name = "ProviderNotConfiguredError";
  }
}

/** Thrown when an external service call fails. Maps to HTTP 502. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
