import { describe, it, expect } from "vitest";
import { DEFAULT_BASE_URL, MAX_LIST_ITEMS, STAKES_NETWORKS, STAKES_TOKENS } from "../src/constants.js";

describe("constants", () => {
  it("defaults to the preview API host", () => {
    expect(DEFAULT_BASE_URL).toBe("https://preview.api.stakefi.network/v1");
  });

  it("caps list results at 25", () => {
    expect(MAX_LIST_ITEMS).toBe(25);
  });

  it("exposes the get_stakes network subset, not the full network list", () => {
    expect(STAKES_NETWORKS).toContain("ethereum");
    expect(STAKES_NETWORKS).toContain("solana");
    expect(STAKES_NETWORKS).not.toContain("tezos");
    expect(STAKES_NETWORKS.length).toBe(23);
  });

  it("exposes the 13 tokens get_stakes accepts", () => {
    expect(STAKES_TOKENS).toEqual([
      "POL", "SOL", "SOMI", "MON", "MANTRA", "NILL", "KAIA",
      "ADA", "S", "NEAR", "APT", "ROCK", "HBAR",
    ]);
  });
});
