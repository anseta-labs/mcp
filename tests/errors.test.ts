import { describe, it, expect } from "vitest";
import { AnsetaApiError, parseErrorBody } from "../src/errors.js";

describe("parseErrorBody", () => {
  it("extracts code and message from the ErrorResponse envelope", () => {
    const err = parseErrorBody(400, {
      success: false,
      error: { code: "INVALID_NETWORK", message: "Unknown network 'polygon'" },
    });
    expect(err).toBeInstanceOf(AnsetaApiError);
    expect(err.code).toBe("INVALID_NETWORK");
    expect(err.status).toBe(400);
  });

  it("falls back when the body is not the documented envelope", () => {
    const err = parseErrorBody(502, "<html>gateway</html>");
    expect(err.code).toBe("UPSTREAM_ERROR");
    expect(err.message).toContain("502");
  });

  it("tells the model to fix its input on a 400", () => {
    const err = parseErrorBody(400, {
      success: false,
      error: { code: "INVALID_NETWORK", message: "Unknown network 'polygon'" },
    });
    const msg = err.toModelMessage();
    expect(msg).toContain("Unknown network 'polygon'");
    expect(msg).toContain("Check the arguments");
  });

  it("tells the model not to retry on a 401", () => {
    const err = parseErrorBody(401, { success: false, error: { code: "UNAUTHORIZED", message: "bad key" } });
    expect(err.toModelMessage()).toContain("Do not retry");
  });

  it("tells the model to back off on a 429", () => {
    const err = parseErrorBody(429, { success: false, error: { code: "RATE_LIMITED", message: "slow down" } });
    expect(err.toModelMessage()).toContain("Rate limited");
  });
});
