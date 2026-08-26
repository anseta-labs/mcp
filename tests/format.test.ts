import { describe, it, expect } from "vitest";
import { sanitize, project, capList, toToolResult, errorResult } from "../src/format.js";

describe("sanitize", () => {
  it("strips control characters but preserves ordinary whitespace", () => {
    expect(sanitize("good\u0000\u001Bna me")).toBe("goodna me");
  });

  it("keeps newlines and tabs", () => {
    expect(sanitize("line1\nline2\tend")).toBe("line1\nline2\tend");
  });

  it("truncates very long strings", () => {
    const long = "a".repeat(500);
    expect(String(sanitize(long))).toHaveLength(303); // 300 + ellipsis
  });

  it("recurses into objects and arrays", () => {
    expect(sanitize({ a: ["x\u0000y"] })).toEqual({ a: ["xy"] });
  });

  it("leaves numbers and booleans alone", () => {
    expect(sanitize({ n: 5, b: true, z: null })).toEqual({ n: 5, b: true, z: null });
  });
});

describe("project", () => {
  it("keeps only the listed fields", () => {
    const rows = [{ validatorId: "1", moniker: "Alice", ownerAddress: "0xabc", details: "long" }];
    expect(project(rows, ["validatorId", "moniker"])).toEqual([{ validatorId: "1", moniker: "Alice" }]);
  });

  it("omits fields absent from the row rather than emitting undefined", () => {
    const rows = [{ validatorId: "1" }];
    expect(project(rows, ["validatorId", "moniker"])).toEqual([{ validatorId: "1" }]);
  });

  it("sanitizes projected values", () => {
    const rows = [{ moniker: "Bad\u0000Name" }];
    expect(project(rows, ["moniker"])).toEqual([{ moniker: "BadName" }]);
  });
});

describe("capList", () => {
  it("reports truncation and the true total", () => {
    const rows = Array.from({ length: 40 }, (_, i) => i);
    const result = capList(rows);
    expect(result.rows).toHaveLength(25);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(40);
  });

  it("does not mark short lists as truncated", () => {
    expect(capList([1, 2, 3]).truncated).toBe(false);
  });
});

describe("toToolResult", () => {
  it("serializes payloads as JSON text", () => {
    const result = toToolResult({ a: 1 });
    expect(result.content[0]!.text).toContain('"a": 1');
  });

  it("appends a note when given one", () => {
    const result = toToolResult({ a: 1 }, "Showing 25 of 40.");
    expect(result.content[0]!.text).toContain("Showing 25 of 40.");
  });
});

describe("errorResult", () => {
  it("marks the result as an error", () => {
    expect(errorResult("boom").isError).toBe(true);
  });
});
