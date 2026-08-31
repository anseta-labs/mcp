import { describe, it, expect, vi } from "vitest";
import { stakingWriteTools } from "../../src/tools/staking-write.js";
import { stubApis } from "../support.js";


function toolNamed(name: string) {
  const tool = stakingWriteTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`missing tool ${name}`);
  }

  return tool;
}

const BASE = { network: "solana", token: "SOL", staker: "abc", decimals: 9 } as const;
const TXS = { success: true, data: { transactions: [{ encodedTx: "0xdead" }] } };

async function callStake(args: Record<string, unknown>) {
  const post = vi.fn(async () => TXS);
  const result = await toolNamed("build_stake_tx").handler({ ...BASE, ...args }, stubApis({ createStake: post }));

  return { text: result.content[0]!.text, isError: result.isError === true, post };
}

describe("argument rules", () => {
  it("requires a validator on Solana", async () => {
    const { text, isError, post } = await callStake({ amount: "1" });
    expect(isError).toBe(true);
    expect(text).toContain("validator");
    expect(post).not.toHaveBeenCalled();
  });

  it("requires an amount on Solana", async () => {
    const { text, isError } = await callStake({ validator: "v" });
    expect(isError).toBe(true);
    expect(text).toContain("amount");
  });

  it("allows a missing amount on Cardano", async () => {
    const { isError } = await callStake({
      network: "cardano", token: "ADA", staker: "addr1", validator: "pool1",
    });

    expect(isError).toBe(false);
  });

  it("rejects an amount that is not a base-unit integer string", async () => {
    const { text, isError } = await callStake({ validator: "v", amount: "1.5" });
    expect(isError).toBe(true);
    expect(text).toContain("base denomination");
  });

  it("rejects a numeric amount at the schema boundary", async () => {
    const { text, isError, post } = await callStake({ validator: "v", amount: 1000000000 });
    expect(isError).toBe(true);
    expect(text).toContain("Invalid arguments");
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects negative token decimals before calling the API", async () => {
    const { text, isError, post } = await callStake({
      validator: "v",
      amount: "1",
      decimals: -1,
    });

    expect(isError).toBe(true);
    expect(text).toContain("expected number to be >=0");
    expect(text).toContain("decimals");
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a network the SDK does not know", async () => {
    const { isError } = await callStake({ network: "tezos", validator: "v", amount: "1" });
    expect(isError).toBe(true);
  });

  it("accepts a well-formed request", async () => {
    const { isError, post } = await callStake({ validator: "vote1", amount: "1000000000" });
    expect(isError).toBe(false);
    expect(post).toHaveBeenCalled();
  });
});

describe("write tools", () => {
  it("exposes three tools", () => {
    expect(stakingWriteTools.map((t) => t.name)).toEqual([
      "build_stake_tx", "build_unstake_tx", "build_withdraw_tx",
    ]);
  });

  it("returns a validation error without calling the API", async () => {
    const post = vi.fn();
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", amount: "1000", decimals: 9 }, ctx,
    );

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("echoes decoded parameters alongside the transaction", async () => {
    const post = vi.fn(async () => ({ success: true, data: { transactions: [{ type: "Delegate", encodedTx: "0xdead", transactionType: "solana", encodingFormat: "base58" }] } }));
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "vote1", amount: "1000000000", decimals: 9 }, ctx,
    );

    const text = result.content[0]!.text;
    expect(text).toContain("REVIEW BEFORE SIGNING");
    expect(text).toContain("1 SOL");
    expect(text).toContain("vote1");
    expect(text).toContain("0xdead");
  });

  it("does not send the display-only decimals field to the API", async () => {
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createStake: post });
    await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "vote1", amount: "1000000000", decimals: 9 }, ctx,
    );

    expect(post).toHaveBeenCalledWith({
      simplifiedStakeRequest: {
        network: "solana", token: "SOL", staker: "abc", validator: "vote1", amount: "1000000000",
      },
    });
  });

  it("formats fractional amounts correctly", async () => {
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1500000", decimals: 9 }, ctx,
    );

    expect(result.content[0]!.text).toContain("0.0015 SOL");
  });

  it("says the amount is undecodable when decimals are not supplied", async () => {
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1500000" }, ctx,
    );

    // decimals only ever decorates the review line, so its absence must not
    // block a call the API would have accepted.
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain("decimals not provided");
    expect(post).toHaveBeenCalled();
  });

  it("rejects a success response that has no transaction data", async () => {
    const post = vi.fn(async () => ({ success: true, data: undefined }));
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1", decimals: 9 },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("did not return any transactions");
    expect(result.content[0]!.text).not.toContain("REVIEW BEFORE SIGNING");
  });

  it("rejects a success response with an empty transaction list", async () => {
    const post = vi.fn(async () => ({ success: true, data: { transactions: [] } }));
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1", decimals: 9 },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("did not return any transactions");
    expect(result.content[0]!.text).not.toContain("REVIEW BEFORE SIGNING");
  });

  it("returns only the payload the API produced, not the envelope around it", async () => {
    const post = vi.fn(async () => ({ success: true, data: { transactions: [{ encodedTx: "0xdead" }] } }));
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1", decimals: 9 }, ctx,
    );

    const body = result.content[0]!.text.split("\n\nREVIEW")[0]!;
    expect(JSON.parse(body)).toEqual({ transactions: [{ encodedTx: "0xdead" }] });
  });

  it("preserves long encoded transactions byte-for-byte", async () => {
    const encodedTx = `0x${"ab".repeat(400)}`;
    const post = vi.fn(async () => ({ success: true, data: { transactions: [{ encodedTx }] } }));
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1", decimals: 9 },
      ctx,
    );

    const body = result.content[0]!.text.split("\n\nREVIEW")[0]!;
    expect(JSON.parse(body)).toEqual({ transactions: [{ encodedTx }] });
  });

  it("states that the transaction is unsigned", async () => {
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createUnstake: post });
    const result = await toolNamed("build_unstake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1", decimals: 9 }, ctx,
    );

    expect(result.content[0]!.text).toContain("unsigned");
  });

  it("build_withdraw_tx does not accept an amount", () => {
    expect(Object.keys(toolNamed("build_withdraw_tx").schema)).not.toContain("amount");
  });

  it("build_withdraw_tx still enforces the validator requirement", async () => {
    const post = vi.fn();
    const ctx = stubApis({ createStake: post });
    const result = await toolNamed("build_withdraw_tx").handler(
      { network: "solana", token: "SOL", staker: "abc" }, ctx,
    );

    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("distinguishes unstake from withdraw in both descriptions", () => {
    expect(toolNamed("build_unstake_tx").description).toContain("build_withdraw_tx");
    expect(toolNamed("build_withdraw_tx").description).toContain("build_unstake_tx");
  });
});

describe("build_withdraw_tx", () => {
  it("does not demand an amount on a network where staking requires one", async () => {
    // Withdrawal claims whatever is available, so the amount rule must not
    // apply to it — Solana requires an amount to stake but not to withdraw.
    const post = vi.fn(async () => TXS);
    const ctx = stubApis({ createStakingWithdrawal: post });
    const result = await toolNamed("build_withdraw_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "vote1" }, ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(post).toHaveBeenCalled();
  });
});
