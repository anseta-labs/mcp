import { sanitize, toolResult } from "../output.js";
import type { ToolResult } from "../output.js";

/**
 * Every `build_*_tx` tool returns its transactions behind the same review
 * block. It lives here, in one place, because the wording is a domain
 * invariant rather than presentation: the server never holds a signing key and
 * never broadcasts, and the model is told so on every single write result.
 */
const UNSIGNED_NOTICE =
  "These transactions are unsigned. The user must review and sign them in their own wallet; Anseta never holds a signing key and has not broadcast anything.";

/** Decodes a base-unit amount for human review. Never used to build the request body. */
export function humanAmount(amount: string, decimals: number | undefined, token: string): string {
  if (decimals === undefined) {
    return "unknown (decimals not provided)";
  }

  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = decimals > 0 ? padded.slice(padded.length - decimals).replace(/0+$/, "") : "";

  return `${whole}${frac ? "." + frac : ""} ${token}`;
}

/** The value shown on the `amount:` line: base units, then the decoded amount. */
export function reviewAmount(amount: string, decimals: number | undefined, token: string): string {
  return `${amount} base units = ${humanAmount(amount, decimals, token)}`;
}

/**
 * Serializes a transaction payload under an aligned review block.
 *
 * `fields` is rendered in insertion order, and a field whose value is
 * undefined is dropped from the output but still counted when sizing the
 * label column, so a tool's layout does not shift depending on which optional
 * arguments a particular call supplied.
 */
export function buildTxResult(
  action: string,
  fields: Record<string, string | undefined>,
  payload: unknown,
): ToolResult {
  const width = Math.max(...Object.keys(fields).map((label) => label.length)) + 2;

  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => `  ${(label + ":").padEnd(width)}${value}`);

  const review = [
    `REVIEW BEFORE SIGNING - ${action}`,
    ...lines,
    "",
    UNSIGNED_NOTICE,
  ].join("\n");

  return toolResult(sanitize(payload ?? {}), review);
}
