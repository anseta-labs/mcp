import { z } from "zod";
import { StakingNetwork, StakingToken } from "@anseta/typescript-sdk";
import { NETWORK_RULES } from "../constants.js";
import { ensureSuccess } from "../errors.js";
import { toolResult, errorResult, sanitize } from "../output.js";
import { defineTool } from "./types.js";
import type { AnsetaTool, ToolArgs, ToolResult } from "./types.js";

const commonSchema = {
  network: z.enum(StakingNetwork).describe("Network identifier from list_networks."),
  token: z.enum(StakingToken).describe("Token symbol from list_tokens."),
  staker: z.string().describe("Staker address. 0x hex for EVM, base58 for Solana, bech32 for Cosmos and Cardano."),
  validator: z.string().optional().describe("Validator address. Required for Cosmos networks, Solana, Cardano, Polygon, Kaia, and Somnia."),
  params: z.record(z.string(), z.unknown()).optional().describe("Additional network-specific parameters."),
};

const stakeSchema = {
  ...commonSchema,
  // Rejected at the schema so a decimal or a JS number never reaches the handler.
  // Base-denomination amounts exceed the range a number represents exactly,
  // which is why this is a string.
  amount: z
    .string()
    .regex(
      /^\d+$/,
      "must be an integer string in the token's base denomination, not a decimal token value — call list_tokens for the token's decimals and multiply",
    )
    .describe(
      "Amount in the token's BASE denomination as an integer string, not a decimal token value. 1 SOL (9 decimals) is '1000000000'. Required on every network except Cardano.",
    )
    .optional(),
  // Optional deliberately: this value is only ever used to render the review
  // line, so a missing one degrades that line rather than rejecting a call the
  // API would have accepted — Cardano stakes carry no amount to decode at all.
  decimals: z
    .number()
    .int()
    .optional()
    .describe("Token decimals from list_tokens. Supplied so the result can show a human-readable amount; it is not sent to the API."),
};

type StakeArgs = ToolArgs<typeof stakeSchema>;
type WithdrawArgs = ToolArgs<typeof commonSchema>;

/**
 * Enforces the conditional requirements the OpenAPI `required` array cannot
 * express. Shape and format are already guaranteed by the schema, so only the
 * per-network rules are left to check here.
 */
function checkNetworkRules(args: StakeArgs | WithdrawArgs, amount?: string): string | null {
  const rule = NETWORK_RULES[args.network];
  if (rule.validatorRequired && !args.validator) {
    return `Network '${args.network}' requires a 'validator' argument. Call list_validators with network='${args.network}' to find one.`;
  }
  if (rule.amountRequired && amount === undefined) {
    return `Network '${args.network}' requires an 'amount' argument, as a string in the token's base denomination.`;
  }
  return null;
}

/** Decodes a base-unit amount for human review. Never used to build the request body. */
function humanAmount(amount: string, decimals: number | undefined, token: StakingToken): string {
  if (decimals === undefined) return "unknown (decimals not provided)";
  const padded = amount.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = decimals > 0 ? padded.slice(padded.length - decimals).replace(/0+$/, "") : "";
  return `${whole}${frac ? "." + frac : ""} ${token}`;
}

interface ReviewAmount {
  value: string;
  decimals?: number;
}

function buildResult(
  action: string,
  args: StakeArgs | WithdrawArgs,
  amount: ReviewAmount | undefined,
  payload: unknown,
): ToolResult {
  const review = [
    `REVIEW BEFORE SIGNING - ${action}`,
    `  network:   ${args.network}`,
    `  token:     ${args.token}`,
    `  staker:    ${args.staker}`,
    args.validator ? `  validator: ${args.validator}` : null,
    amount ? `  amount:    ${amount.value} base units = ${humanAmount(amount.value, amount.decimals, args.token)}` : null,
    "",
    "These transactions are unsigned. The user must review and sign them in their own wallet; Anseta never holds a signing key and has not broadcast anything.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return toolResult(sanitize(payload ?? {}), review);
}

export const stakingWriteTools: AnsetaTool[] = [
  defineTool({
    name: "build_stake_tx",
    description:
      "Build unsigned transactions that delegate tokens to a validator. Returns transaction objects for the user to review and sign in their own wallet; nothing is broadcast and no funds move as a result of this call. Amount must be an integer string in the token's base denomination - call list_tokens for the decimals. Confirm the validator with list_validators first.",
    schema: stakeSchema,
    handler: async (args, ctx) => {
      const invalid = checkNetworkRules(args, args.amount);
      if (invalid) return errorResult(invalid);
      const response = ensureSuccess(await ctx.staking.createStake({
        simplifiedStakeRequest: {
          network: args.network,
          token: args.token,
          staker: args.staker,
          validator: args.validator,
          amount: args.amount,
          params: args.params,
        },
      }));
      const review = args.amount === undefined ? undefined : { value: args.amount, decimals: args.decimals };
      return buildResult("STAKE", args, review, response.data);
    },
  }),
  defineTool({
    name: "build_unstake_tx",
    description:
      "Build unsigned transactions that begin unbonding a delegation. This starts the unbonding period; it does NOT move tokens back to the wallet. After unbonding completes, use build_withdraw_tx to claim them. Amount must be an integer string in the token's base denomination. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: stakeSchema,
    handler: async (args, ctx) => {
      const invalid = checkNetworkRules(args, args.amount);
      if (invalid) return errorResult(invalid);
      const response = ensureSuccess(await ctx.staking.createUnstake({
        simplifiedStakeRequest: {
          network: args.network,
          token: args.token,
          staker: args.staker,
          validator: args.validator,
          amount: args.amount,
          params: args.params,
        },
      }));
      const review = args.amount === undefined ? undefined : { value: args.amount, decimals: args.decimals };
      return buildResult("UNSTAKE (begins unbonding)", args, review, response.data);
    },
  }),
  defineTool({
    name: "build_withdraw_tx",
    description:
      "Build unsigned transactions that claim tokens whose unbonding period has finished, or claim accrued rewards. This is the step AFTER build_unstake_tx, not a substitute for it: unstaking alone does not return tokens to the wallet. Takes no amount - it claims whatever is available. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: commonSchema,
    handler: async (args, ctx) => {
      // Withdrawal takes no amount, so only the validator rule applies.
      const rule = NETWORK_RULES[args.network];
      if (rule.validatorRequired && !args.validator) {
        const message = `Network '${args.network}' requires a 'validator' argument. Call list_validators with network='${args.network}' to find one.`;
        return errorResult(message);
      }
      const response = ensureSuccess(await ctx.staking.createStakingWithdrawal({
        createStakingWithdrawalRequest: {
          network: args.network,
          token: args.token,
          staker: args.staker,
          validator: args.validator,
          params: args.params,
        },
      }));

      return buildResult("WITHDRAW (claims unbonded tokens or rewards)", args, undefined, response.data);
    },
  }),
];
