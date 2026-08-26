import { describe, it, expect } from "vitest";
import { allTools } from "../src/tools/index.js";
import { createAnsetaServer } from "../src/server.js";

describe("tool registry", () => {
  it("exposes exactly 12 tools", () => {
    expect(allTools).toHaveLength(12);
  });

  it("has no duplicate names", () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a snake_case name and a real description", () => {
    for (const tool of allTools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.description.length).toBeLessThan(1024);
    }
  });
});

describe("createAnsetaServer", () => {
  it("constructs without touching the network", () => {
    expect(() => createAnsetaServer({ apiKey: "test-key" })).not.toThrow();
  });

  it("rejects a missing API key", () => {
    expect(() => createAnsetaServer({ apiKey: "" })).toThrow();
  });
});
