import type { z } from "zod";
import type { AnsetaClient } from "../client.js";

export interface ToolContext { client: AnsetaClient }

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
}

export interface AnsetaTool {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
