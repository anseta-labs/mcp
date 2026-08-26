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

function isErrorEnvelope(body: unknown): body is { error: { code: string; message: string; details?: unknown } } {
  if (typeof body !== "object" || body === null) return false;
  const err = (body as Record<string, unknown>).error;
  return (
    typeof err === "object" && err !== null &&
    typeof (err as Record<string, unknown>).code === "string" &&
    typeof (err as Record<string, unknown>).message === "string"
  );
}

export function parseErrorBody(status: number, body: unknown): AnsetaApiError {
  if (isErrorEnvelope(body)) {
    return new AnsetaApiError(status, body.error.code, body.error.message, body.error.details);
  }
  return new AnsetaApiError(status, "UPSTREAM_ERROR", `Request failed with status ${status}`, body);
}
