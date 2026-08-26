import { describe, it, expect } from "vitest";
import validators from "./fixtures/validators.json" with { type: "json" };
import stakes from "./fixtures/stakes.json" with { type: "json" };

describe("validators fixture", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(validators)).toBe(true);
    expect((validators as unknown[]).length).toBeGreaterThan(0);
  });

  it("carries the fields the projection depends on", () => {
    const row = (validators as Record<string, unknown>[])[0]!;
    for (const field of ["validatorId", "validatorAddress", "moniker", "status", "network"]) {
      expect(Object.keys(row)).toContain(field);
    }
  });
});

describe("stakes fixture", () => {
  it("carries the fields the projection depends on", () => {
    const row = (stakes as Record<string, unknown>[])[0]!;
    for (const field of ["network", "token", "stakerAddress", "validatorAddress", "amount", "status"]) {
      expect(Object.keys(row)).toContain(field);
    }
  });

  it("returns raw base-unit amounts with no formatted twin", () => {
    const row = (stakes as Record<string, unknown>[])[0]!;
    expect(Object.keys(row)).not.toContain("amountFormatted");
    expect(typeof row.amount).toBe("string");
  });
});
