import { describe, it, expect, vi } from "vitest";
import { AnsetaClient } from "../src/client.js";
import { AnsetaApiError } from "../src/errors.js";

function stubFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("AnsetaClient", () => {
  it("sends the API key in the x-api-key header, never the query string", async () => {
    const fetchImpl = stubFetch(200, { success: true, data: [] });
    const client = new AnsetaClient({ apiKey: "secret-key", fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.get("/info/networks");

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).not.toContain("secret-key");
    expect((init as RequestInit).headers).toMatchObject({ "x-api-key": "secret-key" });
  });

  it("omits undefined query params and stringifies numbers", async () => {
    const fetchImpl = stubFetch(200, { success: true, data: [] });
    const client = new AnsetaClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.get("/staking/daily-reward-history/v1", { limit: 25, startDate: undefined });

    const url = String(fetchImpl.mock.calls[0]![0]);
    expect(url).toContain("limit=25");
    expect(url).not.toContain("startDate");
  });

  it("throws AnsetaApiError on a non-2xx response", async () => {
    const fetchImpl = stubFetch(400, { success: false, error: { code: "BAD", message: "nope" } });
    const client = new AnsetaClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.get("/info/networks")).rejects.toBeInstanceOf(AnsetaApiError);
  });

  it("unwraps the success envelope and returns data", async () => {
    const fetchImpl = stubFetch(200, { success: true, data: [{ network: "solana" }] });
    const client = new AnsetaClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const result = await client.get<Array<{ network: string }>>("/info/networks");
    expect(result).toEqual([{ network: "solana" }]);
  });

  it("posts JSON bodies", async () => {
    const fetchImpl = stubFetch(200, { success: true, data: { transactions: [] } });
    const client = new AnsetaClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.post("/staking/stake", { network: "solana" });

    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ network: "solana" });
  });
});
