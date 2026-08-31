import { z } from "zod";
import { VALIDATOR_REQUIRED_NETWORKS, AMOUNT_OPTIONAL_NETWORKS } from "../constants.js";
import { guard } from "./shared.js";
import { toToolResult, errorResult, sanitize } from "../format.js";
import type { SimplifiedStakeRequest } from "@anseta/typescript-sdk";
import { defineTool } from "./types.js";
import type { AnsetaTool, ToolContext, ToolArgs } from "./types.js";

const BASE_UNIT_PATTERN = /^\d+$/;

/**
 * Enforces the conditional requirements the OpenAPI `required` array cannot
 * express: SimplifiedStakeRequest lists only network/token/staker as required,
 * but `validator` is mandatory on most networks and `amount` on all but Cardano.
 */
export function validateStakeArgs(args: StakeArgs): string | null {
  const network = String(args.network ?? "");
  const needsValidator = (VALIDATOR_REQUIRED_NETWORKS as readonly string[]).includes(network);
  const amountOptional = (AMOUNT_OPTIONAL_NETWORKS as readonly string[]).includes(network);

  if (needsValidator && !args.validator) {
    return `Network '${network}' requires a 'validator' argument. Call list_validators with network='${network}' to find one.`;
  }
  if (!amountOptional && !args.amount) {
    return `Network '${network}' requires an 'amount' argument, as a string in the token's base denomination.`;
  }
  if (args.amount !== undefined && typeof args.amount !== "string") {
    return `'amount' must be a string, not a number. Base-denomination amounts exceed the range a JavaScript number represents exactly. Received: ${JSON.stringify(args.amount)}.`;
  }
  if (args.amount !== undefined && !BASE_UNIT_PATTERN.test(args.amount)) {
    return `'amount' must be an integer string in the token's base denomination, not a decimal token value. Call list_tokens to get the token's decimals and multiply. Received: '${args.amount}'.`;
  }
  return null;
}

/** Decodes a base-unit amount for human review. Never used to build the request body. */
function humanAmount(amount: unknown, decimals: unknown, token: unknown): string {
  if (typeof amount !== "string" || typeof decimals !== "number") return "unknown (decimals not provided)";
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = decimals > 0 ? padded.slice(padded.length - decimals).replace(/0+$/, "") : "";
  return `${whole}${frac ? "." + frac : ""} ${String(token)}`;
}

function buildResult(action: string, args: StakeArgs, payload: unknown) {
  const review = [
    `REVIEW BEFORE SIGNING - ${action}`,
    `  network:   ${String(args.network)}`,
    `  token:     ${String(args.token)}`,
    `  staker:    ${String(args.staker)}`,
    args.validator ? `  validator: ${String(args.validator)}` : null,
    args.amount ? `  amount:    ${String(args.amount)} base units = ${humanAmount(args.amount, args.decimals, args.token)}` : null,
    "",
    "These transactions are unsigned. The user must review and sign them in their own wallet; Anseta never holds a signing key and has not broadcast anything.",
  ].filter(Boolean).join("\n");

  return toToolResult(sanitize(payload), review);
}

const commonSchema = {
  network: z.string().describe("Network identifier from list_networks."),
  token: z.string().describe("Token symbol from list_tokens."),
  staker: z.string().describe("Staker address. 0x hex for EVM, base58 for Solana, bech32 for Cosmos and Cardano."),
  validator: z.string().optional().describe("Validator address. Required for Cosmos networks, Solana, Cardano, Polygon, Kaia, and Somnia."),
  decimals: z.number().int().optional().describe("Token decimals from list_tokens. Supplied so the result can show a human-readable amount; it is not sent to the API."),
  params: z.record(z.string(), z.unknown()).optional().describe("Additional network-specific parameters."),
};

type StakeArgs = ToolArgs<typeof commonSchema> & { amount?: string };

const amountSchema = z.string().describe(
  "Amount in the token's BASE denomination as an integer string, not a decimal token value. 1 SOL (9 decimals) is '1000000000'. Required on every network except Cardano.",
);

function apiBody(args: StakeArgs, includeAmount: boolean): SimplifiedStakeRequest {
  return {
    network: args.network as SimplifiedStakeRequest["network"],
    token: args.token as SimplifiedStakeRequest["token"],
    staker: args.staker,
    ...(args.validator ? { validator: args.validator } : {}),
    ...(includeAmount && args.amount ? { amount: args.amount } : {}),
    ...(args.params ? { params: args.params } : {}),
  };
}

export const stakingWriteTools: AnsetaTool[] = [
  defineTool({
    name: "build_stake_tx",
    description:
      "Build unsigned transactions that delegate tokens to a validator. Returns transaction objects for the user to review and sign in their own wallet; nothing is broadcast and no funds move as a result of this call. Amount must be an integer string in the token's base denomination - call list_tokens for the decimals. Confirm the validator with list_validators first.",
    schema: { ...commonSchema, amount: amountSchema.optional() },
    handler: (args, ctx: ToolContext) =>
      guard(async () => {
        const invalid = validateStakeArgs(args);
        if (invalid) return errorResult(invalid);
        const payload = await ctx.staking.createStake({
          simplifiedStakeRequest: apiBody(args, true),
        });
        return buildResult("STAKE", args, payload);
      }),
  }),
  defineTool({
    name: "build_unstake_tx",
    description:
      "Build unsigned transactions that begin unbonding a delegation. This starts the unbonding period; it does NOT move tokens back to the wallet. After unbonding completes, use build_withdraw_tx to claim them. Amount must be an integer string in the token's base denomination. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: { ...commonSchema, amount: amountSchema.optional() },
    handler: (args, ctx: ToolContext) =>
      guard(async () => {
        const invalid = validateStakeArgs(args);
        if (invalid) return errorResult(invalid);
        const payload = await ctx.staking.createUnstake({
          simplifiedStakeRequest: apiBody(args, true),
        });
        return buildResult("UNSTAKE (begins unbonding)", args, payload);
      }),
  }),
  defineTool({
    name: "build_withdraw_tx",
    description:
      "Build unsigned transactions that claim tokens whose unbonding period has finished, or claim accrued rewards. This is the step AFTER build_unstake_tx, not a substitute for it: unstaking alone does not return tokens to the wallet. Takes no amount - it claims whatever is available. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: commonSchema,
    handler: (args, ctx: ToolContext) =>
      guard(async () => {
        if ((VALIDATOR_REQUIRED_NETWORKS as readonly string[]).includes(String(args.network)) && !args.validator) {
          return errorResult(
            `Network '${String(args.network)}' requires a 'validator' argument. Call list_validators with network='${String(args.network)}' to find one.`,
          );
        }
        const payload = await ctx.staking.createStakingWithdrawal({
          createStakingWithdrawalRequest: apiBody(args, false),
        });
        return buildResult("WITHDRAW (claims unbonded tokens or rewards)", args, payload);
      }),
  }),
];
