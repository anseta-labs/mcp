import { z } from "zod";
import { MAX_LIST_ITEMS } from "../constants.js";

/**
 * Argument builders shared by more than one tool family. Kept free of
 * `.transform`: McpServer parses arguments against a tool's shape before
 * calling the handler, and `defineTool` parses them again, so a schema whose
 * output does not re-parse would reject its own valid input. Convert types
 * inside the handler instead.
 */

export const limitArg = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(MAX_LIST_ITEMS)
  .describe("Maximum rows to return.");

/**
 * Base-denomination amounts exceed the range a JS number represents exactly,
 * which is why this is a string, and the regex rejects a decimal token value
 * at the schema so it can never reach a request body.
 */
export const amountArg = z
  .string()
  .regex(
    /^\d+$/,
    "must be an integer string in the token's base denomination, not a decimal token value — call list_tokens for the token's decimals and multiply",
  )
  .describe(
    "Amount in the token's BASE denomination as an integer string, not a decimal token value. 1 SOL (9 decimals) is '1000000000'.",
  );

/**
 * Optional deliberately: this value is only ever used to render the review
 * line, so a missing one degrades that line rather than rejecting a call the
 * API would have accepted.
 */
export const decimalsArg = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe(
    "Token decimals from list_tokens. Supplied so the result can show a human-readable amount; it is not sent to the API.",
  );
