import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineTool } from "../src/tools/types.js";
import { AnsetaApiError, ToolArgumentError } from "../src/errors.js";
import { stubApis } from "./support.js";

const ctx = stubApis({});

/**
 * defineTool is the single error boundary: a handler never returns an error
 * result of its own, it throws, and this decides the wording. These pin each
 * way a handler can fail, because they all have to arrive as readable text
 * rather than as an exception escaping into the transport.
 */
describe("the tool error boundary", () => {
  function toolThatThrows(error: Error) {
    return defineTool({
      name: "example_tool",
      description: "x",
      schema: { network: z.string() },
      handler: () => {
        throw error;
      },
    });
  }

  it("reports a bad argument against the schema", async () => {
    const result = await toolThatThrows(new Error("unreachable")).handler({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Invalid arguments for example_tool");
  });

  it("passes a per-network rule through verbatim, not as a transport failure", async () => {
    const message = "Network 'solana' requires a 'validator' argument.";
    const result = await toolThatThrows(new ToolArgumentError(message)).handler(
      { network: "solana" }, ctx,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe(message);
    expect(result.content[0]!.text).not.toContain("unreachable");
  });

  it("translates an upstream error into retry advice", async () => {
    const result = await toolThatThrows(new AnsetaApiError(429, "RATE_LIMITED", "slow down"))
      .handler({ network: "solana" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Rate limited");
  });

  it("does not let an unexpected throw escape", async () => {
    const result = await toolThatThrows(new TypeError("boom")).handler({ network: "solana" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("boom");
  });
});
