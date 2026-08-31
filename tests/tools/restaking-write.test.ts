import { describe, it, expect, vi } from "vitest";
import { restakingWriteTools } from "../../src/tools/restaking-write.js";
import { stubApis } from "../support.js";

function toolNamed(name: string) {
  const tool = restakingWriteTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`no tool named ${name}`);
  }

  return tool;
}

const TXS = { success: true, data: { transactions: [{ encodedTx: "0xdead" }] } };

describe("restaking write tools", () => {
  it("exposes the five write tools in lifecycle order", () => {
    expect(restakingWriteTools.map((t) => t.name)).toEqual([
      "build_restaking_deposit_tx",
      "build_restaking_delegate_tx",
      "build_restaking_unstake_tx",
      "build_restaking_undelegate_tx",
      "build_restaking_withdraw_tx",
    ]);
  });

  it("every write tool states that the transactions are unsigned", async () => {
    const calls = {
      build_restaking_deposit_tx: ["createRestakingDeposit", { network: "ethereum", token: "STETH", staker: "0xabc", amount: "1", decimals: 18 }],
      build_restaking_delegate_tx: ["createRestakingDelegation", { network: "ethereum", staker: "0xabc", operator: "0xop" }],
      build_restaking_unstake_tx: ["createRestakingUnstake", { network: "ethereum", token: "STETH", staker: "0xabc", amount: "1", decimals: 18 }],
      build_restaking_undelegate_tx: ["createRestakingUndelegation", { network: "ethereum", staker: "0xabc" }],
      build_restaking_withdraw_tx: ["createRestakingWithdrawal", { network: "ethereum", token: "STETH", staker: "0xabc" }],
    } as const;

    for (const [name, [method, args]] of Object.entries(calls)) {
      const ctx = stubApis({ [method]: vi.fn(async () => TXS) });
      const result = await toolNamed(name).handler(args, ctx);
      expect(result.isError, name).toBeUndefined();
      expect(result.content[0]!.text, name).toContain("REVIEW BEFORE SIGNING");
      expect(result.content[0]!.text, name).toContain("Anseta never holds a signing key");
    }
  });

  it("deposit sends the API body without the display-only decimals field", async () => {
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createRestakingDeposit: post });
    await toolNamed("build_restaking_deposit_tx").handler(
      { network: "ethereum", token: "STETH", staker: "0xabc", amount: "1000000000000000000", decimals: 18 }, ctx,
    );

    expect(post).toHaveBeenCalledWith({
      restakingDepositRequest: {
        network: "ethereum", token: "STETH", staker: "0xabc", amount: "1000000000000000000",
      },
    });
  });

  it("deposit decodes the amount for review and says it is only half the flow", async () => {
    const ctx = stubApis({ createRestakingDeposit: vi.fn(async () => TXS) });
    const result = await toolNamed("build_restaking_deposit_tx").handler(
      { network: "ethereum", token: "STETH", staker: "0xabc", amount: "1500000000000000000", decimals: 18 }, ctx,
    );

    const text = result.content[0]!.text;
    expect(text).toContain("1.5 STETH");
    expect(text).toContain("step 1 of 2");
  });

  it("delegate sends no amount, because it delegates the whole deposited balance", async () => {
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createRestakingDelegation: post });
    await toolNamed("build_restaking_delegate_tx").handler(
      { network: "ethereum", staker: "0xabc", operator: "0xop" }, ctx,
    );

    expect(post).toHaveBeenCalledWith({
      restakingDelegateRequest: { network: "ethereum", staker: "0xabc", operator: "0xop" },
    });

    expect(Object.keys(toolNamed("build_restaking_delegate_tx").schema)).not.toContain("amount");
  });

  it("undelegate takes neither token nor amount and warns that it queues everything", async () => {
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createRestakingUndelegation: post });
    const result = await toolNamed("build_restaking_undelegate_tx").handler(
      { network: "ethereum", staker: "0xabc" }, ctx,
    );

    expect(post).toHaveBeenCalledWith({
      restakingUndelegateRequest: { network: "ethereum", staker: "0xabc" },
    });

    expect(Object.keys(toolNamed("build_restaking_undelegate_tx").schema)).toEqual(["network", "staker"]);
    expect(result.content[0]!.text).toContain("ALL restaked assets");
  });

  it("unstake keeps the delegation, which the review block says", async () => {
    const ctx = stubApis({ createRestakingUnstake: vi.fn(async () => TXS) });
    const result = await toolNamed("build_restaking_unstake_tx").handler(
      { network: "ethereum", token: "EIGEN", staker: "0xabc", amount: "1", decimals: 18 }, ctx,
    );

    expect(result.content[0]!.text).toContain("delegation kept");
  });

  it("withdraw takes no amount", () => {
    expect(Object.keys(toolNamed("build_restaking_withdraw_tx").schema)).not.toContain("amount");
  });

  it("rejects a decimal amount at the schema, before any request is built", async () => {
    const post = vi.fn();
    const ctx = stubApis({ createRestakingDeposit: post });
    const result = await toolNamed("build_restaking_deposit_tx").handler(
      { network: "ethereum", token: "STETH", staker: "0xabc", amount: "1.5" }, ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("base denomination");
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a network EigenLayer does not run on", async () => {
    const post = vi.fn();
    const ctx = stubApis({ createRestakingDeposit: post });
    const result = await toolNamed("build_restaking_deposit_tx").handler(
      { network: "solana", token: "STETH", staker: "0xabc", amount: "1" }, ctx,
    );

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("requires an amount, which restaking makes mandatory on every network", async () => {
    const post = vi.fn();
    const ctx = stubApis({ createRestakingUnstake: post });
    const result = await toolNamed("build_restaking_unstake_tx").handler(
      { network: "ethereum", token: "STETH", staker: "0xabc" }, ctx,
    );

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("returns only the payload the API produced, not the envelope around it", async () => {
    const ctx = stubApis({ createRestakingDeposit: vi.fn(async () => TXS) });
    const result = await toolNamed("build_restaking_deposit_tx").handler(
      { network: "ethereum", token: "STETH", staker: "0xabc", amount: "1", decimals: 18 }, ctx,
    );

    const body = result.content[0]!.text.split("\n\nREVIEW")[0]!;
    expect(JSON.parse(body)).toEqual({ transactions: [{ encodedTx: "0xdead" }] });
  });
});
