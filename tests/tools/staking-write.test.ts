import { describe, it, expect, vi } from "vitest";
import { stakingWriteTools, validateStakeArgs } from "../../src/tools/staking-write.js";
import { stubClient } from "../support.js";
import type { AnsetaApi } from "../../src/client.js";

function toolNamed(name: string) {
  const tool = stakingWriteTools.find((t) => t.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

describe("validateStakeArgs", () => {
  it("requires a validator on Solana", () => {
    const msg = validateStakeArgs({ network: "solana", token: "SOL", staker: "abc", amount: "1" });
    expect(msg).toContain("validator");
  });

  it("requires an amount on Solana", () => {
    const msg = validateStakeArgs({ network: "solana", token: "SOL", staker: "abc", validator: "v" });
    expect(msg).toContain("amount");
  });

  it("allows a missing amount on Cardano", () => {
    expect(validateStakeArgs({ network: "cardano", token: "ADA", staker: "addr1", validator: "pool1" })).toBeNull();
  });

  it("rejects an amount that is not a base-unit integer string", () => {
    const msg = validateStakeArgs({ network: "solana", token: "SOL", staker: "a", validator: "v", amount: "1.5" });
    expect(msg).toContain("base denomination");
  });

  it("rejects a numeric amount at the schema boundary", async () => {
    const ctx = stubClient({});
    await expect(
      toolNamed("build_stake_tx").handler(
        { network: "solana", token: "SOL", staker: "a", validator: "v", amount: 1000000000 },
        ctx,
      ),
    ).rejects.toThrow();
  });

  it("accepts a well-formed request", () => {
    expect(validateStakeArgs({
      network: "solana", token: "SOL", staker: "abc", validator: "vote1", amount: "1000000000",
    })).toBeNull();
  });
});

describe("write tools", () => {
  it("exposes three tools", () => {
    expect(stakingWriteTools.map((t) => t.name)).toEqual([
      "build_stake_tx", "build_unstake_tx", "build_withdraw_tx",
    ]);
  });

  it("returns a validation error without calling the API", async () => {
    const post = vi.fn<AnsetaApi["post"]>();
    const ctx = stubClient({ post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", amount: "1000" }, ctx,
    );
    expect(result.isError).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it("echoes decoded parameters alongside the transaction", async () => {
    const post = vi.fn<AnsetaApi["post"]>(async () => ({ transactions: [{ type: "Delegate", encodedTx: "0xdead", transactionType: "solana", encodingFormat: "base58" }] }));
    const ctx = stubClient({ post });
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
    const post = vi.fn<AnsetaApi["post"]>(async () => ({ transactions: [] }));
    const ctx = stubClient({ post });
    await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "vote1", amount: "1000000000", decimals: 9 }, ctx,
    );
    expect(post).toHaveBeenCalledWith("/staking/stake", {
      network: "solana", token: "SOL", staker: "abc", validator: "vote1", amount: "1000000000",
    });
  });

  it("formats fractional amounts correctly", async () => {
    const post = vi.fn<AnsetaApi["post"]>(async () => ({ transactions: [] }));
    const ctx = stubClient({ post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1500000", decimals: 9 }, ctx,
    );
    expect(result.content[0]!.text).toContain("0.0015 SOL");
  });

  it("says the amount is undecodable when decimals are not supplied", async () => {
    const post = vi.fn<AnsetaApi["post"]>(async () => ({ transactions: [] }));
    const ctx = stubClient({ post });
    const result = await toolNamed("build_stake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1500000" }, ctx,
    );
    expect(result.content[0]!.text).toContain("decimals not provided");
  });

  it("states that the transaction is unsigned", async () => {
    const post = vi.fn<AnsetaApi["post"]>(async () => ({ transactions: [] }));
    const ctx = stubClient({ post });
    const result = await toolNamed("build_unstake_tx").handler(
      { network: "solana", token: "SOL", staker: "abc", validator: "v", amount: "1" }, ctx,
    );
    expect(result.content[0]!.text).toContain("unsigned");
  });

  it("build_withdraw_tx does not accept an amount", () => {
    expect(Object.keys(toolNamed("build_withdraw_tx").schema)).not.toContain("amount");
  });

  it("build_withdraw_tx still enforces the validator requirement", async () => {
    const post = vi.fn<AnsetaApi["post"]>();
    const ctx = stubClient({ post });
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
