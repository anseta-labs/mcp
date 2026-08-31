import { describe, it, expect, vi } from "vitest";
import { infoTools } from "../../src/tools/info.js";
import { AnsetaApiError } from "../../src/errors.js";
import { stubApis } from "../support.js";


function toolNamed(name: string) {
  const tool = infoTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }

  return tool;
}

describe("info tools", () => {
  it("exposes exactly four tools with snake_case names", () => {
    expect(infoTools.map((t) => t.name)).toEqual([
      "list_networks", "list_tokens", "list_staking_options", "list_entities",
    ]);
  });

  it("keeps every description under 1024 characters", () => {
    for (const tool of infoTools) {
      expect(tool.description.length).toBeLessThan(1024);
    }
  });

  it("list_tokens tells the model that decimals convert to base units", () => {
    expect(toolNamed("list_tokens").description).toContain("decimals");
  });

  it("accepts restaking network and token filters in discovery tools", async () => {
    const getTokens = vi.fn(async () => ({ success: true, data: [] }));
    const getStakingOptions = vi.fn(async () => ({ success: true, data: [] }));
    const ctx = stubApis({ getTokens, getStakingOptions });

    const filters = { network: "ethereum-hoodi-testnet", symbol: "STETH" };
    const tokenResult = await toolNamed("list_tokens").handler(filters, ctx);
    const optionResult = await toolNamed("list_staking_options").handler(
      { network: filters.network, token: filters.symbol, protocol: "eigenlayer" },
      ctx,
    );

    expect(tokenResult.isError).toBeUndefined();
    expect(optionResult.isError).toBeUndefined();
    expect(getTokens).toHaveBeenCalledWith(expect.objectContaining(filters));
    expect(getStakingOptions).toHaveBeenCalledWith(expect.objectContaining({
      network: filters.network,
      token: filters.symbol,
      protocol: "eigenlayer",
    }));
  });

  it("list_networks passes filters through to the client", async () => {
    const getNetworks = vi.fn(async () => ({
      success: true,
      data: [{ network: "solana", type: "solana", testnet: false }],
    }));

    const ctx = stubApis({ getNetworks });
    await toolNamed("list_networks").handler({ network: "solana" }, ctx);
    expect(getNetworks).toHaveBeenCalledWith({ network: "solana", testnet: undefined });
  });

  it("projects tokens down to the useful fields", async () => {
    const getTokens = vi.fn(async () => ({
      success: true,
      data: [
        { symbol: "SOL", network: "solana", decimals: 9, denomination: "lamports",
          native: true, testnet: false, tokenAddress: "0xabc", internalId: "drop-me" },
      ],
    }));

    const ctx = stubApis({ getTokens });
    const result = await toolNamed("list_tokens").handler({}, ctx);
    expect(result.content[0]!.text).toContain("SOL");
    expect(result.content[0]!.text).not.toContain("internalId");
  });

  it("returns a model-readable error instead of throwing", async () => {
    const getNetworks = vi.fn(async () => { throw new AnsetaApiError(400, "BAD", "nope"); });
    const ctx = stubApis({ getNetworks });
    const result = await toolNamed("list_networks").handler({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Check the arguments");
  });

  it("returns every upstream row", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ symbol: `T${i}`, network: "x", decimals: 6 }));
    const getTokens = vi.fn(async () => ({ success: true, data: rows }));
    const ctx = stubApis({ getTokens });
    const result = await toolNamed("list_tokens").handler({}, ctx);
    expect(JSON.parse(result.content[0]!.text)).toHaveLength(40);
  });

  it("tolerates a null or non-array payload", async () => {
    const getEntities = vi.fn(async () => ({ success: true, data: undefined }));
    const ctx = stubApis({ getEntities });
    const result = await toolNamed("list_entities").handler({}, ctx);
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("[]");
  });
});
