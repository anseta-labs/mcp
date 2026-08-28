import { z } from "zod";
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

/** Arguments a handler receives, inferred from its own schema. */
export type ToolArgs<S extends z.ZodRawShape> = z.infer<z.ZodObject<S>>;

export interface ToolDefinition<S extends z.ZodRawShape> {
  name: string;
  description: string;
  schema: S;
  handler(args: ToolArgs<S>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * The registry holds tools with differing schemas, so the argument type is
 * erased here. Define tools with `defineTool` to keep it inside the handler.
 */
export interface AnsetaTool {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * Infers a handler's argument types from the schema declared beside it, so
 * handlers read their arguments without casting. The single assertion here
 * replaces one at every argument access.
 */
export function defineTool<S extends z.ZodRawShape>(
  tool: ToolDefinition<S>,
): AnsetaTool {
  return tool as unknown as AnsetaTool;
}
