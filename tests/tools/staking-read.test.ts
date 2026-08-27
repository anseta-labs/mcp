import { describe, it, expect, vi } from "vitest";
import { stakingReadTools } from "../../src/tools/staking-read.js";
import type { AnsetaClient } from "../../src/client.js";

function toolNamed(name: string) {
  const tool = stakingReadTools.find((t) => t.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

describe("staking read tools", () => {
  it("exposes the five expected tools", () => {
    expect(stakingReadTools.map((t) => t.name)).toEqual([
      "list_validators", "get_stakes", "get_delegation_history",
      "get_reward_history", "get_daily_rewards",
    ]);
  });

  it("get_stakes description warns that all four arguments are required", () => {
    const description = toolNamed("get_stakes").description;
    expect(description).toContain("list_validators");
  });

  it("get_stakes rejects a network outside the supported subset", () => {
    const schema = toolNamed("get_stakes").schema;
    expect(() => (schema.network as any).parse("tezos")).toThrow();
    expect((schema.network as any).parse("solana")).toBe("solana");
  });

  it("get_daily_rewards defaults limit to 25 and sends it as a string-safe value", async () => {
    const get = vi.fn(async () => []);
    const ctx = { client: { get } as unknown as AnsetaClient };
    await toolNamed("get_daily_rewards").handler({ validatorId: "v-1" }, ctx);
    expect(get).toHaveBeenCalledWith(
      "/staking/daily-reward-history/v-1",
      expect.objectContaining({ limit: 25 }),
    );
  });

  it("url-encodes identifiers in the path", async () => {
    const get = vi.fn(async () => []);
    const ctx = { client: { get } as unknown as AnsetaClient };
    await toolNamed("get_reward_history").handler({ validatorId: "a/b" }, ctx);
    expect(get.mock.calls[0]![0]).toBe("/staking/withdraw-rewards-tx-history/a%2Fb");
  });

  it("prefers formatted amounts over raw base units in history output", async () => {
    const get = vi.fn(async () => [{
      validatorId: "v-1", amount: "1000000000", amountFormatted: "1.0",
      tokenSymbol: "SOL", timestamp: "2026-01-01T00:00:00Z", eventType: "delegate",
      transactionHash: "0xdead", network: "solana", blockNumber: "12345",
      delegatorAddress: "abc", validatorAddress: "def", decimals: 9,
    }]);
    const ctx = { client: { get } as unknown as AnsetaClient };
    const result = await toolNamed("get_delegation_history").handler({ validatorId: "v-1" }, ctx);
    expect(result.content[0]!.text).toContain("amountFormatted");
    expect(result.content[0]!.text).not.toContain("blockNumber");
  });

  it("projects validators using the real upstream field names", async () => {
    const get = vi.fn(async () => [{
      validatorId: "solana-abc", validatorAddress: "abc", moniker: "Example",
      status: "LIVE", network: { name: "solana", type: "mainnet", tokenSymbol: "SOL", decimals: 9 },
      commissionRate: "0.05", publicDelegationEnabled: true, website: "https://x.invalid",
      ownerAddress: "owner", stakingContract: "contract", details: "long text",
    }]);
    const ctx = { client: { get } as unknown as AnsetaClient };
    const result = await toolNamed("list_validators").handler({ network: "solana" }, ctx);
    const text = result.content[0]!.text;
    expect(text).toContain("validatorId");
    expect(text).toContain("commissionRate");
    expect(text).not.toContain("ownerAddress");
    expect(text).not.toContain("stakingContract");
  });

  it("projects stakes using the StakeSchema field names, keeping base-unit amounts", async () => {
    const get = vi.fn(async () => ({ stakes: [{
      network: "solana", token: "SOL", tokenAddress: null,
      stakerAddress: "DYw8", validatorAddress: "he1i", amount: "1000000000",
      status: "staked", rewards: "12500000", internalId: "drop-me",
    }] }));
    const ctx = { client: { get } as unknown as AnsetaClient };
    const result = await toolNamed("get_stakes").handler(
      { staker: "DYw8", network: "solana", validator: "he1i", token: "SOL" }, ctx,
    );
    const text = result.content[0]!.text;
    expect(text).toContain("stakerAddress");
    expect(text).toContain('"amount": "1000000000"');
    expect(text).toContain("rewards");
    expect(text).not.toContain("internalId");
  });

  it("get_stakes unwraps the data.stakes envelope", async () => {
    const get = vi.fn(async () => ({ stakes: [
      { network: "mantra", token: "MANTRA", stakerAddress: "mantra1fz9",
        validatorAddress: "mantravaloper1r3s", amount: "11500000000002370806", status: "staked" },
    ] }));
    const ctx = { client: { get } as unknown as AnsetaClient };
    const result = await toolNamed("get_stakes").handler(
      { staker: "mantra1fz9", network: "mantra", validator: "mantravaloper1r3s", token: "MANTRA" }, ctx,
    );
    expect(result.content[0]!.text).toContain("11500000000002370806");
  });

  it("get_stakes degrades to empty when the envelope is missing", async () => {
    const get = vi.fn(async () => null);
    const ctx = { client: { get } as unknown as AnsetaClient };
    const result = await toolNamed("get_stakes").handler(
      { staker: "a", network: "solana", validator: "v", token: "SOL" }, ctx,
    );
    expect(result.content[0]!.text).toBe("[]");
    expect(result.isError).toBeUndefined();
  });

});
