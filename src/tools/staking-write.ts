import { z } from "zod";
import { StakingNetwork, StakingToken } from "@anseta/typescript-sdk";
import { NETWORK_RULES } from "../constants.js";
import { ensureSuccess } from "../errors.js";
import { errorResult } from "../output.js";
import { amountArg, decimalsArg } from "./args.js";
import { buildTxResult, reviewAmount } from "./review.js";
import { defineTool } from "./types.js";
import type { AnsetaTool, ToolArgs } from "./types.js";

const commonSchema = {
  network: z.enum(StakingNetwork).describe("Network identifier from list_networks."),
  token: z.enum(StakingToken).describe("Token symbol from list_tokens."),
  staker: z.string().describe("Staker address. 0x hex for EVM, base58 for Solana, bech32 for Cosmos and Cardano."),
  validator: z.string().optional().describe("Validator address. Required for Cosmos networks, Solana, Cardano, Polygon, Kaia, and Somnia."),
  params: z.record(z.string(), z.unknown()).optional().describe("Additional network-specific parameters."),
};

const stakeSchema = {
  ...commonSchema,
  amount: amountArg
    .describe(
      "Amount in the token's BASE denomination as an integer string, not a decimal token value. 1 SOL (9 decimals) is '1000000000'. Required on every network except Cardano.",
    )
    .optional(),
  decimals: decimalsArg,
};

type StakeArgs = ToolArgs<typeof stakeSchema>;
type WithdrawArgs = ToolArgs<typeof commonSchema>;

/**
 * Enforces the conditional requirements the OpenAPI `required` array cannot
 * express. Shape and format are already guaranteed by the schema, so only the
 * per-network rules are left to check here.
 */
function checkValidatorRule(args: StakeArgs | WithdrawArgs): string | null {
  if (NETWORK_RULES[args.network].validatorRequired && !args.validator) {
    return `Network '${args.network}' requires a 'validator' argument. Call list_validators with network='${args.network}' to find one.`;
  }
  return null;
}

/**
 * The amount rule applies only to the tools that take an amount at all.
 * `build_withdraw_tx` claims whatever is available, so it checks the validator
 * rule alone — asking it for an amount would reject every valid call.
 */
function checkStakeRules(args: StakeArgs): string | null {
  const validator = checkValidatorRule(args);
  if (validator) return validator;

  if (NETWORK_RULES[args.network].amountRequired && args.amount === undefined) {
    return `Network '${args.network}' requires an 'amount' argument, as a string in the token's base denomination.`;
  }
  return null;
}

/** The review block's fields, in the order they are shown. */
function reviewFields(args: StakeArgs | WithdrawArgs, amount: ReviewAmountArgs | undefined) {
  return {
    network: args.network,
    token: args.token,
    staker: args.staker,
    validator: args.validator,
    amount: amount === undefined ? undefined : reviewAmount(amount.value, amount.decimals, args.token),
  };
}

interface ReviewAmountArgs {
  value: string;
  decimals: number | undefined;
}

/** Undefined when the network takes no amount, so the review line is dropped. */
function stakeReviewAmount(args: StakeArgs): ReviewAmountArgs | undefined {
  return args.amount === undefined ? undefined : { value: args.amount, decimals: args.decimals };
}

export const stakingWriteTools: AnsetaTool[] = [
  defineTool({
    name: "build_stake_tx",
    description:
      "Build unsigned transactions that delegate tokens to a validator. Returns transaction objects for the user to review and sign in their own wallet; nothing is broadcast and no funds move as a result of this call. Amount must be an integer string in the token's base denomination - call list_tokens for the decimals. Confirm the validator with list_validators first.",
    schema: stakeSchema,
    handler: async (args, ctx) => {
      const invalid = checkStakeRules(args);
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

      return buildTxResult("STAKE", reviewFields(args, stakeReviewAmount(args)), response.data);
    },
  }),
  defineTool({
    name: "build_unstake_tx",
    description:
      "Build unsigned transactions that begin unbonding a delegation. This starts the unbonding period; it does NOT move tokens back to the wallet. After unbonding completes, use build_withdraw_tx to claim them. Amount must be an integer string in the token's base denomination. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: stakeSchema,
    handler: async (args, ctx) => {
      const invalid = checkStakeRules(args);
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

      return buildTxResult("UNSTAKE (begins unbonding)", reviewFields(args, stakeReviewAmount(args)), response.data);
    },
  }),
  defineTool({
    name: "build_withdraw_tx",
    description:
      "Build unsigned transactions that claim tokens whose unbonding period has finished, or claim accrued rewards. This is the step AFTER build_unstake_tx, not a substitute for it: unstaking alone does not return tokens to the wallet. Takes no amount - it claims whatever is available. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: commonSchema,
    handler: async (args, ctx) => {
      const invalid = checkValidatorRule(args);
      if (invalid) return errorResult(invalid);

      const response = ensureSuccess(await ctx.staking.createStakingWithdrawal({
        createStakingWithdrawalRequest: {
          network: args.network,
          token: args.token,
          staker: args.staker,
          validator: args.validator,
          params: args.params,
        },
      }));

      return buildTxResult(
        "WITHDRAW (claims unbonded tokens or rewards)",
        reviewFields(args, undefined),
        response.data,
      );
    },
  }),
];
