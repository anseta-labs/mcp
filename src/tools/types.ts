import type { z } from "zod";
import type { AnsetaClient } from "../client.js";

export interface ToolContext { client: AnsetaClient }

/**
 * The MCP SDK's CallToolResult carries an open index signature, so ours does
 * too — without it the handler type is not assignable at registration.
 */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
  [key: string]: unknown;
}

export interface AnsetaTool {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
