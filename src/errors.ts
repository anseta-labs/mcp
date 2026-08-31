import { ResponseError } from "@anseta/typescript-sdk";

export class AnsetaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
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
    const head = `Anseta API error ${this.status} (${this.code}): ${this.message}`;
    if (this.status === 400 || this.status === 422) {
      return `${head}\n\nCheck the arguments against the tool schema and call again with corrected values.`;
    }
    if (this.status === 401 || this.status === 403) {
      return `${head}\n\nThe configured API key is missing or not permitted for this operation. Do not retry; report this to the user.`;
    }
    if (this.status === 404) {
      return `${head}\n\nThe requested resource does not exist. Verify identifiers with list_validators or list_networks before retrying.`;
    }
    if (this.status === 429) {
      return `${head}\n\nRate limited. Wait before retrying and avoid repeating the same call in a loop.`;
    }
    return `${head}\n\nUpstream failure. Retrying once is reasonable; if it persists, report it to the user.`;
  }
}

function isErrorEnvelope(
  body: unknown,
): body is { error: { code: string; message: string; details?: unknown } } {
  if (typeof body !== "object" || body === null) return false;
  const err = (body as Record<string, unknown>).error;
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as Record<string, unknown>).code === "string" &&
    typeof (err as Record<string, unknown>).message === "string"
  );
}

export function parseErrorBody(status: number, body: unknown): AnsetaApiError {
  if (isErrorEnvelope(body)) {
    return new AnsetaApiError(
      status,
      body.error.code,
      body.error.message,
      body.error.details,
    );
  }
  return new AnsetaApiError(
    status,
    "UPSTREAM_ERROR",
    `Request failed with status ${status}`,
    body,
  );
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
    let body: unknown;
    try {
      body = await error.response.clone().json();
    } catch {
      body = undefined;
    }
    return parseErrorBody(error.response.status, body);
  }

  // No response at all: DNS failure, refused connection, a bad base URL.
  const message = error instanceof Error ? error.message : String(error);
  return new AnsetaApiError(0, "NETWORK_ERROR", message);
}
