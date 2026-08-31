import { describe, it, expect } from "vitest";
import { sanitize, project, trimResponse, toolResult, errorResult } from "../src/output.js";

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
  it("keeps only the trimResponse fields", () => {
    const rows = [{ validatorId: "1", moniker: "Alice", ownerAddress: "0xabc", details: "long" }];
    expect(project(rows, ["validatorId", "moniker"])).toEqual([{ validatorId: "1", moniker: "Alice" }]);
  });

  it("omits fields absent from the row rather than emitting undefined", () => {
    const rows: { validatorId: string; moniker?: string }[] = [{ validatorId: "1" }];
    expect(project(rows, ["validatorId", "moniker"])).toEqual([{ validatorId: "1" }]);
  });

  it("sanitizes projected values", () => {
    const rows = [{ moniker: "Bad\u0000Name" }];
    expect(project(rows, ["moniker"])).toEqual([{ moniker: "BadName" }]);
  });
});

describe("trimResponse", () => {
  it("caps long lists and reports the true total", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ validatorId: String(i) }));
    const text = trimResponse(rows, ["validatorId"]).content[0]!.text;
    expect(JSON.parse(text.slice(0, text.indexOf("\n\nShowing")))).toHaveLength(25);
    expect(text).toContain("Showing 25 of 40 results");
  });

  it("does not add a truncation note to a short list", () => {
    const text = trimResponse([{ validatorId: "1" }], ["validatorId"]).content[0]!.text;
    expect(text).not.toContain("Showing");
  });

  it("treats a missing list as empty rather than throwing", () => {
    const result = trimResponse<{ validatorId: string }, "validatorId">(undefined, ["validatorId"]);
    expect(result.content[0]!.text).toBe("[]");
  });
});

describe("toolResult", () => {
  it("serializes payloads as JSON text", () => {
    const result = toolResult({ a: 1 });
    expect(result.content[0]!.text).toContain('"a": 1');
  });

  it("appends a note when given one", () => {
    const result = toolResult({ a: 1 }, "Showing 25 of 40.");
    expect(result.content[0]!.text).toContain("Showing 25 of 40.");
  });
});

describe("errorResult", () => {
  it("marks the result as an error", () => {
    expect(errorResult("boom").isError).toBe(true);
  });
});
