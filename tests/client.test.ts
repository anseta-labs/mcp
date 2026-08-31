import { describe, it, expect } from "vitest";
import { createApis } from "../src/client.js";
import { DEFAULT_BASE_URL } from "../src/constants.js";

describe("createApis", () => {
  it("rejects a missing API key", () => {
    expect(() => createApis({ apiKey: "" })).toThrow(/ANSETA_API_KEY/);
  });

  it("builds both API clients", () => {
    const apis = createApis({ apiKey: "k" });
    expect(typeof apis.info.getNetworks).toBe("function");
    expect(typeof apis.staking.getValidators).toBe("function");
  });

  it("drops a /v1 suffix, which the SDK adds itself", async () => {
    // Earlier versions of this server took a base URL ending in /v1. Keeping it
    // would produce /v1/v1/... once the SDK adds its own prefix.
    const seen: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      seen.push(input instanceof Request ? input.url : String(input));

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const apis = createApis({
      apiKey: "k",
      baseUrl: "https://example.invalid/v1",
      fetchImpl,
    });

    await apis.info.getNetworks({});

    expect(seen[0]).toContain("https://example.invalid/v1/info/networks");
    expect(seen[0]).not.toContain("/v1/v1/");
  });

  it("sends the API key as the x-api-key header", async () => {
    const seen: RequestInit[] = [];
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init ?? {});

      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const apis = createApis({ apiKey: "secret-key", fetchImpl });
    await apis.info.getNetworks({});

    expect(JSON.stringify(seen[0]?.headers)).toContain("secret-key");
  });

  it("defaults to the preview host without a /v1 suffix", () => {
    expect(DEFAULT_BASE_URL).toBe("https://preview.api.stakefi.network");
    expect(DEFAULT_BASE_URL.endsWith("/v1")).toBe(false);
  });
});
