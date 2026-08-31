import { toAnsetaError } from "../errors.js";
import { capList, project, toToolResult, errorResult } from "../format.js";
import type { ToolResult } from "./types.js";

/** Wraps a handler so upstream failures become model-readable text, not exceptions. */
export async function guard(
  fn: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await fn();
  } catch (error) {
    return errorResult((await toAnsetaError(error)).toModelMessage());
  }
}

/**
 * Trims an upstream list down to what a model should read: at most
 * MAX_LIST_ITEMS rows, only the named fields, and a note saying how many were
 * left out. Coerces first, because upstream sometimes sends null or a bare
 * object where an array is expected.
 */
export function trimResponse(
  rows: unknown,
  fields: readonly string[],
): ToolResult {
  const array = Array.isArray(rows) ? rows : rows == null ? [] : [rows];
  const {
    rows: capped,
    truncated,
    total,
  } = capList(array as Record<string, unknown>[]);
  const note = truncated
    ? `Showing ${capped.length} of ${total} results. Narrow the filters to see others.`
    : undefined;
  return toToolResult(project(capped, fields), note);
}
