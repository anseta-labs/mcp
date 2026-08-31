import { z } from "zod";
import { ResponseError } from "@anseta/typescript-sdk";

/** Advice appended to each status, so the model knows whether retrying helps. */
const ADVICE: Record<number, string> = {
  400: "Check the arguments against the tool schema and call again with corrected values.",
  422: "Check the arguments against the tool schema and call again with corrected values.",
  401: "The configured API key is missing or not permitted for this operation. Do not retry; report this to the user.",
  403: "The configured API key is missing or not permitted for this operation. Do not retry; report this to the user.",
  404: "The requested resource does not exist. Verify identifiers with list_validators or list_networks before retrying.",
  429: "Rate limited. Wait before retrying and avoid repeating the same call in a loop.",
};

const DEFAULT_ADVICE =
  "Upstream failure. Retrying once is reasonable; if it persists, report it to the user.";

export class AnsetaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AnsetaApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Text returned to the model as tool output. Must say whether retrying helps. */
  toModelMessage(): string {
    if (this.status === 0) {
      return `Anseta API unreachable (${this.code}): ${this.message}\n\nThis is a connectivity or configuration problem, not a bad argument. Check ANSETA_BASE_URL and network access; retrying the same call is unlikely to help.`;
    }
    return `Anseta API error ${this.status} (${this.code}): ${this.message}\n\n${ADVICE[this.status] ?? DEFAULT_ADVICE}`;
  }
}

/**
 * The documented error envelope. Parsed with zod rather than a hand-written
 * guard so the narrowing is checked rather than asserted.
 */
const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export function parseErrorBody(status: number, body: unknown): AnsetaApiError {
  const parsed = ErrorEnvelope.safeParse(body);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new AnsetaApiError(status, code, message, details);
  }
  return new AnsetaApiError(status, "UPSTREAM_ERROR", `Request failed with status ${status}`, body);
}

/**
 * Translates whatever the SDK threw into an AnsetaApiError, so the model gets
 * text saying whether retrying helps rather than a stack trace.
 *
 * ResponseError carries the raw Response, so the API's error envelope has to be
 * read off the body here. A body that cannot be read is not worth failing over:
 * the status alone still produces a useful message.
 */
export async function toAnsetaError(error: unknown): Promise<AnsetaApiError> {
  if (error instanceof AnsetaApiError) return error;

  if (error instanceof ResponseError) {
    const body = await error.response
      .clone()
      .json()
      .catch(() => undefined);
    return parseErrorBody(error.response.status, body);
  }

  // No response at all: DNS failure, refused connection, a bad base URL.
  return new AnsetaApiError(
    0,
    "NETWORK_ERROR",
    error instanceof Error ? error.message : String(error),
  );
}
