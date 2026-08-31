import { describe, it, expect } from "vitest";
import { StakingNetwork, StakingToken } from "@anseta/typescript-sdk";
import { DEFAULT_BASE_URL, MAX_LIST_ITEMS } from "../src/constants.js";

describe("constants", () => {
  it("defaults to the preview API host", () => {
    expect(DEFAULT_BASE_URL).toBe("https://preview.api.stakefi.network");
  });

  it("caps list results at 25", () => {
    expect(MAX_LIST_ITEMS).toBe(25);
  });

  it("takes the get_stakes network subset from the SDK, not a local copy", () => {
    const networks = Object.values(StakingNetwork);
    expect(networks).toContain("ethereum");
    expect(networks).toContain("solana");
    expect(networks).not.toContain("tezos");
  });

  it("takes the token list from the SDK", () => {
    const tokens = Object.values(StakingToken);
    expect(tokens).toContain("SOL");
    expect(tokens).toContain("MANTRA");
    expect(tokens).not.toContain("TRX");
  });
});
