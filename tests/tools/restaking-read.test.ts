import { describe, it, expect, vi } from "vitest";
import { restakingReadTools } from "../../src/tools/restaking-read.js";
import { stubApis } from "../support.js";

function toolNamed(name: string) {
  const tool = restakingReadTools.find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool;
}

describe("restaking read tools", () => {
  it("exposes the five read tools", () => {
    expect(restakingReadTools.map((t) => t.name)).toEqual([
      "list_operators",
      "get_restaking_stakes",
      "get_restaking_delegation_history",
      "get_restaking_reward_history",
      "get_restaking_daily_rewards",
    ]);
  });

  it("list_operators takes no arguments, because the endpoint accepts no filters", async () => {
    const getRestakingOperators = vi.fn(async () => ({ success: true, data: [] }));
    const ctx = stubApis({ getRestakingOperators });
    await toolNamed("list_operators").handler({}, ctx);
    expect(Object.keys(toolNamed("list_operators").schema)).toEqual([]);
    expect(getRestakingOperators).toHaveBeenCalledWith();
  });

  it("projects operators down to the useful fields", async () => {
    const getRestakingOperators = vi.fn(async () => ({
      success: true,
      data: [{
        operatorId: "eigen-abc", operatorAddress: "0xop", moniker: "Example",
        status: "LIVE", protocol: "eigenlayer", commissionRate: "0.1",
        publicDelegationEnabled: true, internalId: "drop-me",
      }],
    }));
    const ctx = stubApis({ getRestakingOperators });
    const result = await toolNamed("list_operators").handler({}, ctx);
    const text = result.content[0]!.text;
    expect(text).toContain("operatorAddress");
    expect(text).toContain("eigenlayer");
    expect(text).not.toContain("internalId");
  });

  it("get_restaking_stakes unwraps the data.stakes envelope", async () => {
    const getRestakingPositions = vi.fn(async () => ({ success: true, data: { stakes: [{
      network: "ethereum", token: "STETH", stakerAddress: "0xabc", operatorAddress: "0xop",
      amount: "1500000000000000000", status: "restaked",
      unstakingCompletionDate: "2026-09-07T00:00:00Z", internalId: "drop-me",
    }] } }));
    const ctx = stubApis({ getRestakingPositions });
    const result = await toolNamed("get_restaking_stakes").handler(
      { staker: "0xabc", network: "ethereum", operator: "0xop" }, ctx,
    );
    const text = result.content[0]!.text;
    expect(text).toContain("1500000000000000000");
    expect(text).toContain("unstakingCompletionDate");
    expect(text).not.toContain("internalId");
  });

  it("get_restaking_stakes degrades to empty when the envelope is missing", async () => {
    const getRestakingPositions = vi.fn(async () => ({ success: true, data: undefined }));
    const ctx = stubApis({ getRestakingPositions });
    const result = await toolNamed("get_restaking_stakes").handler(
      { staker: "0xabc", network: "ethereum", operator: "0xop" }, ctx,
    );
    expect(result.content[0]!.text).toBe("[]");
    expect(result.isError).toBeUndefined();
  });

  it("get_restaking_stakes rejects a network outside the restaking subset", () => {
    const { parser } = toolNamed("get_restaking_stakes");
    const args = { staker: "0xabc", operator: "0xop" };
    expect(parser.safeParse({ ...args, network: "solana" }).success).toBe(false);
    expect(parser.safeParse({ ...args, network: "ethereum" }).success).toBe(true);
  });

  it("sends operatorId as the upstream validatorId path parameter", async () => {
    const getRestakingDelegationHistory = vi.fn(async () => ({ success: true, data: [] }));
    const ctx = stubApis({ getRestakingDelegationHistory });
    await toolNamed("get_restaking_delegation_history").handler({ operatorId: "op-1" }, ctx);
    expect(getRestakingDelegationHistory).toHaveBeenCalledWith(
      expect.objectContaining({ validatorId: "op-1" }),
    );
  });

  it("defaults limit to 25 and sends it as the string the SDK expects", async () => {
    const getRestakingDailyRewards = vi.fn(async () => ({ success: true, data: [] }));
    const ctx = stubApis({ getRestakingDailyRewards });
    await toolNamed("get_restaking_daily_rewards").handler({ operatorId: "op-1" }, ctx);
    expect(getRestakingDailyRewards).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: "op-1", limit: "25" }),
    );
  });

  it("projects reward history with the shared history fields", async () => {
    const getRestakingRewardHistory = vi.fn(async () => ({ success: true, data: [{
      validatorId: "op-1", validatorMoniker: "Example", delegatorAddress: "0xabc",
      amount: "1000", amountFormatted: "1.0", tokenSymbol: "EIGEN",
      timestamp: "2026-01-01T00:00:00Z", transactionHash: "0xdead",
      network: "ethereum", blockNumber: "12345",
    }] }));
    const ctx = stubApis({ getRestakingRewardHistory });
    const result = await toolNamed("get_restaking_reward_history").handler({ operatorId: "op-1" }, ctx);
    const text = result.content[0]!.text;
    expect(text).toContain("amountFormatted");
    expect(text).not.toContain("blockNumber");
  });

  it("surfaces an upstream failure as readable text", async () => {
    const getRestakingOperators = vi.fn(async () => ({
      success: false,
      error: { code: "UPSTREAM", message: "operator index unavailable" },
    }));
    const ctx = stubApis({ getRestakingOperators });
    const result = await toolNamed("list_operators").handler({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("operator index unavailable");
  });
});
