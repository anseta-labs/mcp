import { DEFAULT_BASE_URL } from "./constants.js";
import { AnsetaApiError, parseErrorBody } from "./errors.js";

export interface AnsetaClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export type QueryValue = string | number | boolean | undefined;

interface Envelope<T> { success: boolean; data?: T; error?: unknown }

/** The surface the tools use. Depending on this rather than the class lets a
 *  test supply a stub without asserting past the type system. */
export interface AnsetaApi {
  get(path: string, query?: Record<string, QueryValue>): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

export class AnsetaClient implements AnsetaApi {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnsetaClientOptions) {
    if (!options.apiKey) throw new Error("ANSETA_API_KEY is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async get(path: string, query: Record<string, QueryValue> = {}): Promise<unknown> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return this.request(url, { method: "GET" });
  }

  async post(path: string, body: unknown): Promise<unknown> {
    return this.request(new URL(this.baseUrl + path), {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  private async request(url: URL, init: RequestInit): Promise<unknown> {
    // The key travels as a header only. The spec also permits an `api_key`
    // query parameter; query strings land in access logs, so we never use it.
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        ...init,
        headers: { ...(init.headers ?? {}), "x-api-key": this.apiKey },
      });
    } catch (error) {
      // DNS failure, refused connection, TLS error. Status 0 marks "never reached
      // the API" so the model is not told to fix its arguments.
      throw new AnsetaApiError(
        0,
        "NETWORK_ERROR",
        `Could not reach the Anseta API at ${url.origin}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!response.ok) throw parseErrorBody(response.status, parsed);

    const envelope = parsed as Envelope<unknown>;
    if (envelope && typeof envelope === "object" && "success" in envelope) {
      if (envelope.success === false) throw parseErrorBody(response.status, parsed);
      return envelope.data;
    }
    return parsed;
  }
}
