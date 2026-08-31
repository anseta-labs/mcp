import { z } from "zod";
import type { AnsetaApis } from "../client.js";
import { ToolArgumentError, toAnsetaError } from "../errors.js";
import { errorResult, type ToolResult } from "../output.js";

export type ToolContext = AnsetaApis;
export type { ToolResult };

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
 *
 * `parser` is the schema as an object, for callers that want to validate
 * arguments without reaching into the raw shape.
 */
export interface AnsetaTool {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  parser: z.ZodObject<z.ZodRawShape>;
  handler(args: unknown, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * Wraps a tool definition for registration.
 *
 * Arguments are parsed here, and are the only path by which a handler receives
 * them, which is what makes the narrowing to ToolArgs<S> true rather than
 * asserted. McpServer validates against the same shape before calling in and
 * passes the *parsed* result on, so this parse runs on output that has already
 * been through the schema once.
 *
 * That makes parse-idempotence a requirement on every schema here: a field
 * whose output type differs from its input (`.transform(String)` on a number,
 * say) would reject its own valid input on the second pass and the tool would
 * fail for every caller. Convert types inside the handler instead.
 *
 * The try/catch is here rather than in each handler so that every failure path
 * — upstream error, transport failure, a bad argument, or a per-network rule —
 * reaches the model as readable text instead of a thrown exception. Handlers
 * therefore never return an error result themselves: they throw, and this is
 * the one place that decides how a failure is worded.
 */
export function defineTool<S extends z.ZodRawShape>(tool: ToolDefinition<S>): AnsetaTool {
  const parser = z.object(tool.schema);
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    parser,
    handler: async (args, ctx) => {
      try {
        return await tool.handler(parser.parse(args), ctx);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const message = `Invalid arguments for ${tool.name}:\n${z.prettifyError(error)}`;
          return errorResult(message);
        }

        // A rule the schema could not express. Already written for the model,
        // so it is passed through as-is.
        if (error instanceof ToolArgumentError) {
          return errorResult(error.message);
        }
        const message = (await toAnsetaError(error)).toModelMessage();
        return errorResult(message);
      }
    },
  };
}
