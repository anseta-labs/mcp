import { z } from "zod";
import { FetchError, ResponseError } from "@anseta/typescript-sdk";

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

  toModelMessage(): string {
    if (this.status === 0) {
      return `Anseta API unreachable (${this.code}): ${this.message}\n\nThis is a connectivity or configuration problem, not a bad argument. Check ANSETA_BASE_URL and network access; retrying the same call is unlikely to help.`;
    }
    return `Anseta API error ${this.status} (${this.code}): ${this.message}\n\n${ADVICE[this.status] ?? DEFAULT_ADVICE}`;
  }
}

const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

/**
 * Builds the error for a body that carries the API's error envelope.
 *
 * Handlers also call this with status 200: a 2xx response can still say
 * `success: false`, and the generated client does not look at that. Left
 * unchecked, a failed read reports an empty list and a failed build reports a
 * transaction ready to sign, so every handler guards its own call with
 * `if (response.success === false) throw parseErrorBody(200, response);`.
 */
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
    const body: unknown = await error.response
      .clone()
      .json()
      .catch(() => undefined);
    return parseErrorBody(error.response.status, body);
  }

  // No response at all: DNS failure, refused connection, a bad base URL. The
  // SDK's own wrapper message says nothing useful, so report its cause instead.
  const cause = error instanceof FetchError ? error.cause : error;
  return new AnsetaApiError(0, "NETWORK_ERROR", describeCause(cause));
}

/**
 * Node wraps a socket-level failure in a TypeError("fetch failed") whose
 * `cause` holds the real reason, and the SDK wraps that again. Walking the
 * chain is the difference between "fetch failed" and "ENOTFOUND preview.api".
 */
function describeCause(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth++) {
    if (current.message && !messages.includes(current.message)) messages.push(current.message);
    current = current.cause;
  }
  return messages.length > 0 ? messages.join(": ") : String(error);
}
