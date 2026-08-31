import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { allTools } from "../src/tools/index.js";
import { createAnsetaServer } from "../src/server.js";

describe("tool registry", () => {
  it("exposes exactly 12 tools", () => {
    expect(allTools).toHaveLength(12);
  });

  it("has no duplicate names", () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a snake_case name and a real description", () => {
    for (const tool of allTools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.description.length).toBeLessThan(1024);
    }
  });
});

describe("createAnsetaServer", () => {
  it("constructs without touching the network", () => {
    expect(() => createAnsetaServer({ apiKey: "test-key" })).not.toThrow();
  });

  it("rejects a missing API key", () => {
    expect(() => createAnsetaServer({ apiKey: "" })).toThrow();
  });
});

/**
 * The host parses arguments against a tool's schema and hands the *parsed*
 * result to the handler, which then parses them again. These tests go through
 * a real client so that round trip is covered: exercising `tool.handler` with
 * raw arguments cannot see a schema whose output fails to re-parse.
 */
describe("a registered tool, called the way a host calls it", () => {
  function stubFetch(urls: string[], body: unknown = { success: true, data: [] }) {
    return (async (input: RequestInfo | URL) => {
      urls.push(input instanceof Request ? input.url : String(input));
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  }

  async function connect(fetchImpl: typeof fetch) {
    const server = createAnsetaServer({ apiKey: "k", fetchImpl });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return client;
  }

  it("lists every tool with a usable input schema", async () => {
    const client = await connect(stubFetch([]));
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(12);
    for (const tool of tools) expect(tool.inputSchema.type).toBe("object");
  });

  it("applies the default limit rather than rejecting its own parsed arguments", async () => {
    const urls: string[] = [];
    const client = await connect(stubFetch(urls));
    const result = await client.callTool({
      name: "get_daily_rewards",
      arguments: { validatorId: "v-1" },
    });
    expect(result.isError).toBeFalsy();
    expect(urls[0]).toContain("/v1/staking/daily-reward-history/v-1");
    expect(urls[0]).toContain("limit=25");
  });

  it("passes an explicit limit through", async () => {
    const urls: string[] = [];
    const client = await connect(stubFetch(urls));
    const result = await client.callTool({
      name: "get_delegation_history",
      arguments: { validatorId: "v-1", limit: 5 },
    });
    expect(result.isError).toBeFalsy();
    expect(urls[0]).toContain("limit=5");
  });

  it("reports a 200 that carries success:false as an error", async () => {
    const body = { success: false, error: { code: "NOT_LIVE", message: "not live yet" } };
    const client = await connect(stubFetch([], body));
    const result = await client.callTool({ name: "list_networks", arguments: {} });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("not live yet");
  });
});
