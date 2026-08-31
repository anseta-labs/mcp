import { describe, it, expect } from "vitest";
import { FetchError, ResponseError } from "@anseta/typescript-sdk";
import { AnsetaApiError, parseErrorBody, toAnsetaError } from "../src/errors.js";

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

describe("transport failures", () => {
  it("does not tell the model to fix its arguments when the API was never reached", () => {
    const err = new AnsetaApiError(0, "NETWORK_ERROR", "Could not reach the Anseta API at http://x");
    const msg = err.toModelMessage();
    expect(msg).toContain("unreachable");
    expect(msg).not.toContain("Check the arguments");
  });
});

describe("toAnsetaError", () => {
  it("reads the error envelope off a ResponseError's body", async () => {
    const response = new Response(
      JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "no such validator" } }),
      { status: 404, headers: { "content-type": "application/json" } },
    );

    const err = await toAnsetaError(new ResponseError(response, "Response returned an error code"));
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.toModelMessage()).toContain("no such validator");
  });

  it("reports the cause of a transport failure, not the SDK's wrapper text", async () => {
    // What Node throws for an unresolvable host, wrapped the way the SDK wraps it.
    const socket = new Error("getaddrinfo ENOTFOUND preview.api.invalid");
    const fetchFailed = new TypeError("fetch failed", { cause: socket });
    const err = await toAnsetaError(
      new FetchError(fetchFailed, "The request failed and the interceptors did not return an alternative response"),
    );

    expect(err.status).toBe(0);
    expect(err.message).toContain("ENOTFOUND preview.api.invalid");
    expect(err.message).not.toContain("interceptors");
  });
});
