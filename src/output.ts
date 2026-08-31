import { MAX_LIST_ITEMS, MAX_FIELD_CHARS } from "./constants.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Every tool returns text, so this is narrower than the SDK's CallToolResult,
 * whose content is a union of text/image/audio/resource and would force callers
 * to narrow before reading `.text`.
 *
 * Declared as a type alias rather than an interface deliberately: an alias gets
 * an implicit index signature, which is what makes it assignable to
 * CallToolResult at registration. An interface does not, which is why this type
 * previously carried an explicit `[key: string]: unknown`.
 */
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type AssignableToSdk = ToolResult extends CallToolResult ? true : never;
const _assignable: AssignableToSdk = true;
void _assignable;

// Everything except tab, newline, and carriage return. Matching control
// characters is the purpose of this pattern, so the rule against them is off.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitize<T>(value: T): T;
export function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    const cleaned = value.replace(CONTROL_CHARS, "");
    return cleaned.length > MAX_FIELD_CHARS
      ? cleaned.slice(0, MAX_FIELD_CHARS) + "..."
      : cleaned;
  }
  if (Array.isArray(value)) return Array.from<unknown>(value).map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
  }
  return value;
}

/**
 * Narrows upstream rows to the fields worth spending model context on.
 *
 * Returns Partial because a field absent from the row is omitted rather than
 * emitted as undefined; saying Pick here would claim a completeness the output
 * does not have.
 */
export function project<T extends object, K extends keyof T>(
  rows: readonly T[],
  fields: readonly K[],
): Partial<Pick<T, K>>[] {
  return rows.map((row) => {
    const out: Partial<Pick<T, K>> = {};
    for (const field of fields) {
      const value = row[field];
      if (value !== undefined) out[field] = sanitize(value);
    }
    return out;
  });
}

export function toolResult(payload: unknown, note?: string): ToolResult {
  const body = JSON.stringify(payload, null, 2);
  return { content: [{ type: "text", text: note ? `${body}\n\n${note}` : body }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function trimResponse<T extends object, K extends keyof T>(
  rows: readonly T[] | undefined,
  fields: readonly K[],
): ToolResult {
  const all = rows ?? [];
  const capped = all.slice(0, MAX_LIST_ITEMS);
  const note =
    all.length > capped.length
      ? `Showing ${capped.length} of ${all.length} results. Narrow the filters to see others.`
      : undefined;
  return toolResult(project(capped, fields), note);
}
