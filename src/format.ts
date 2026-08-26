import { MAX_LIST_ITEMS, MAX_FIELD_CHARS } from "./constants.js";

// Everything except tab, newline, and carriage return.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Upstream strings (validator monikers, descriptions, websites) are supplied by
 * third parties and flow into model context. Strip control characters and cap
 * length so a hostile field cannot smuggle formatting or run long.
 */
export function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    const cleaned = value.replace(CONTROL_CHARS, "");
    return cleaned.length > MAX_FIELD_CHARS ? cleaned.slice(0, MAX_FIELD_CHARS) + "..." : cleaned;
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
  }
  return value;
}

export function project<T extends object>(rows: T[], fields: readonly string[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const value = (row as Record<string, unknown>)[field];
      if (value !== undefined) out[field] = sanitize(value);
    }
    return out;
  });
}

export function capList<T>(rows: T[], limit: number = MAX_LIST_ITEMS): { rows: T[]; truncated: boolean; total: number } {
  return { rows: rows.slice(0, limit), truncated: rows.length > limit, total: rows.length };
}

export function toToolResult(payload: unknown, note?: string) {
  const body = JSON.stringify(payload, null, 2);
  return { content: [{ type: "text" as const, text: note ? `${body}\n\n${note}` : body }] };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}
