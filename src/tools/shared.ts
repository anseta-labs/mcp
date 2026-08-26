import { AnsetaApiError } from "../errors.js";
import { capList, project, toToolResult, errorResult } from "../format.js";
import type { ToolResult } from "./types.js";

/** Wraps a handler so upstream failures become model-readable text, not exceptions. */
export async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AnsetaApiError) return errorResult(error.toModelMessage());
    return errorResult(`Unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Caps, projects, and serializes a list response. Upstream sometimes returns
 * null or a bare object where the spec promises an array, so coerce first.
 */
export function listed(rows: unknown, fields: readonly string[]): ToolResult {
  const array = Array.isArray(rows) ? rows : rows == null ? [] : [rows];
  const { rows: capped, truncated, total } = capList(array as Record<string, unknown>[]);
  const note = truncated ? `Showing ${capped.length} of ${total} results. Narrow the filters to see others.` : undefined;
  return toToolResult(project(capped, fields), note);
}
