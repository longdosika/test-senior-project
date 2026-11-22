import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, currentUser } from "./api-client";

/** Browser-side API client: the session is a cookie, so every call must include credentials. */
describe("api-client (cookie session)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("sends credentials with every request so the httpOnly session cookie travels", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { items: [] }));
    await apiFetch("/api/tasks");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("include");
  });

  it("serialises a JSON body and sets the content type", async () => {
    fetchMock.mockResolvedValueOnce(json(201, { ok: true }));
    await apiFetch("/api/tasks", { method: "POST", json: { title: "Write report" } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/tasks$/);
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ title: "Write report" }));
  });

  it("never attaches an Authorization header (no token in JavaScript)", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await apiFetch("/api/tasks");
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).has("Authorization")).toBe(false);
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiFetch("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the server message and status", async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: "email already registered" }));
    const err = await apiFetch("/api/auth/register", { method: "POST" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: "email already registered" });
  });

  it("falls back to an HTTP status message when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 502 }));
    await expect(apiFetch("/api/ai/summarize", { method: "POST" })).rejects.toMatchObject({
      status: 502,
      message: "HTTP 502",
    });
  });

  it("currentUser returns the signed-in user when the cookie is valid", async () => {
    const user = { id: "u1", email: "a@example.com", displayName: "A", role: "user" };
    fetchMock.mockResolvedValueOnce(json(200, { user }));
    await expect(currentUser()).resolves.toEqual(user);
  });

  it("currentUser returns null (signed out) on 401 and rethrows other failures", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: "authentication required" }));
    await expect(currentUser()).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(json(500, { error: "internal server error" }));
    await expect(currentUser()).rejects.toMatchObject({ status: 500 });
  });
});
