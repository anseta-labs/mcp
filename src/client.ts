import { DEFAULT_BASE_URL } from "./constants.js";
import { parseErrorBody } from "./errors.js";

export interface AnsetaClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export type QueryValue = string | number | boolean | undefined;

interface Envelope<T> { success: boolean; data?: T; error?: unknown }

export class AnsetaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AnsetaClientOptions) {
    if (!options.apiKey) throw new Error("ANSETA_API_KEY is required");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  async get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(new URL(this.baseUrl + path), {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  }

  private async request<T>(url: URL, init: RequestInit): Promise<T> {
    // The key travels as a header only. The spec also permits an `api_key`
    // query parameter; query strings land in access logs, so we never use it.
    const response = await this.fetchImpl(url, {
      ...init,
      headers: { ...(init.headers ?? {}), "x-api-key": this.apiKey },
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    if (!response.ok) throw parseErrorBody(response.status, parsed);

    const envelope = parsed as Envelope<T>;
    if (envelope && typeof envelope === "object" && "success" in envelope) {
      if (envelope.success === false) throw parseErrorBody(response.status, parsed);
      return envelope.data as T;
    }
    return parsed as T;
  }
}
