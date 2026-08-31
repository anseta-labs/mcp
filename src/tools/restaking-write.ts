import { z } from "zod";
import { RestakingNetwork, RestakingToken } from "@anseta/typescript-sdk";
import { parseErrorBody } from "../errors.js";
import { amountArg, decimalsArg } from "./args.js";
import { buildTxResult, reviewAmount } from "./review.js";
import { defineTool } from "./types.js";
import type { AnsetaTool } from "./types.js";

/**
 * Restaking has no conditional per-network requirements the way staking does:
 * EigenLayer runs on Ethereum only, and every field each endpoint needs is
 * required by the SDK's request type. The schemas below are therefore the whole
 * of the validation, and there is no NETWORK_RULES equivalent to consult.
 */
const networkArg = z
  .enum(RestakingNetwork)
  .describe("Restaking network identifier. EigenLayer runs on Ethereum only.");
const stakerArg = z.string().describe("Ethereum address of the staker, as 0x hex.");
const tokenArg = z
  .enum(RestakingToken)
  .describe("Restaked token symbol. Call list_tokens for its decimals.");

const amountSchema = {
  amount: amountArg.describe(
    "Amount in the token's BASE denomination as an integer string, not a decimal token value. 1 stETH (18 decimals) is '1000000000000000000'.",
  ),
  decimals: decimalsArg,
};

export const restakingWriteTools: AnsetaTool[] = [
  defineTool({
    name: "build_restaking_deposit_tx",
    description:
      "Build unsigned transactions that deposit a liquid staking token or EIGEN into an EigenLayer strategy. Returns an approve transaction followed by a depositIntoStrategy transaction, for the user to review and sign in their own wallet; nothing is broadcast and no funds move as a result of this call. Depositing alone earns nothing: it is step 1 of 2, and build_restaking_delegate_tx must be called afterwards to delegate the deposited assets to an operator.",
    schema: {
      network: networkArg,
      token: tokenArg,
      staker: stakerArg,
      ...amountSchema,
    },
    handler: async (args, ctx) => {
      const response = await ctx.restaking.createRestakingDeposit({
        restakingDepositRequest: {
          network: args.network,
          token: args.token,
          staker: args.staker,
          amount: args.amount,
        },
      });
      if (response.success === false) throw parseErrorBody(200, response);

      return buildTxResult(
        "RESTAKING DEPOSIT (step 1 of 2 - delegate afterwards)",
        {
          network: args.network,
          token: args.token,
          staker: args.staker,
          amount: reviewAmount(args.amount, args.decimals, args.token),
        },
        response.data,
      );
    },
  }),
  defineTool({
    name: "build_restaking_delegate_tx",
    description:
      "Build unsigned transactions that delegate already-deposited EigenLayer assets to an operator. This is step 2 of 2, after build_restaking_deposit_tx; it takes no amount because it delegates the whole deposited balance. A staker can be delegated to only one operator at a time, so delegating requires undelegating from any current operator first. Confirm the operator with list_operators. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: {
      network: networkArg,
      staker: stakerArg,
      operator: z.string().describe("EigenLayer operator address from list_operators."),
    },
    handler: async (args, ctx) => {
      const response = await ctx.restaking.createRestakingDelegation({
        restakingDelegateRequest: {
          network: args.network,
          staker: args.staker,
          operator: args.operator,
        },
      });
      if (response.success === false) throw parseErrorBody(200, response);

      return buildTxResult(
        "RESTAKING DELEGATE (step 2 of 2)",
        {
          network: args.network,
          staker: args.staker,
          operator: args.operator,
        },
        response.data,
      );
    },
  }),
  defineTool({
    name: "build_restaking_unstake_tx",
    description:
      "Build unsigned transactions that queue a PARTIAL EigenLayer withdrawal while remaining delegated to the operator. Use this when the user wants to withdraw a specific amount of one token and keep the rest restaked. It does NOT move tokens back to the wallet: after the withdrawal delay of roughly 7 days on mainnet, build_restaking_withdraw_tx completes it. To exit entirely instead, use build_restaking_undelegate_tx. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: {
      network: networkArg,
      token: tokenArg,
      staker: stakerArg,
      ...amountSchema,
    },
    handler: async (args, ctx) => {
      const response = await ctx.restaking.createRestakingUnstake({
        restakingUnstakeRequest: {
          network: args.network,
          token: args.token,
          staker: args.staker,
          amount: args.amount,
        },
      });
      if (response.success === false) throw parseErrorBody(200, response);

      return buildTxResult(
        "RESTAKING UNSTAKE (queues a partial withdrawal, delegation kept)",
        {
          network: args.network,
          token: args.token,
          staker: args.staker,
          amount: reviewAmount(args.amount, args.decimals, args.token),
        },
        response.data,
      );
    },
  }),
  defineTool({
    name: "build_restaking_undelegate_tx",
    description:
      "Build unsigned transactions that undelegate from an EigenLayer operator. This takes no amount and no token because it is all-or-nothing: it queues EVERY restaked asset the staker holds for withdrawal and ends the delegation. To withdraw only part of a position while staying delegated, use build_restaking_unstake_tx instead. It does NOT move tokens back to the wallet: after the withdrawal delay of roughly 7 days on mainnet, build_restaking_withdraw_tx completes it. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: {
      network: networkArg,
      staker: stakerArg,
    },
    handler: async (args, ctx) => {
      const response = await ctx.restaking.createRestakingUndelegation({
        restakingUndelegateRequest: {
          network: args.network,
          staker: args.staker,
        },
      });
      if (response.success === false) throw parseErrorBody(200, response);

      return buildTxResult(
        "RESTAKING UNDELEGATE (queues ALL restaked assets and ends the delegation)",
        {
          network: args.network,
          staker: args.staker,
        },
        response.data,
      );
    },
  }),
  defineTool({
    name: "build_restaking_withdraw_tx",
    description:
      "Build unsigned transactions that complete EigenLayer withdrawals already queued by build_restaking_unstake_tx or build_restaking_undelegate_tx. This is the step AFTER those, not a substitute for either: queuing alone does not return tokens to the wallet, and this call fails if the withdrawal delay of roughly 7 days on mainnet has not elapsed. Check get_restaking_stakes for the completion date first. Takes no amount - it claims whatever has matured. Returns unsigned transactions for the user to sign; nothing is broadcast.",
    schema: {
      network: networkArg,
      token: tokenArg,
      staker: stakerArg,
    },
    handler: async (args, ctx) => {
      const response = await ctx.restaking.createRestakingWithdrawal({
        restakingWithdrawRequest: {
          network: args.network,
          token: args.token,
          staker: args.staker,
        },
      });
      if (response.success === false) throw parseErrorBody(200, response);

      return buildTxResult(
        "RESTAKING WITHDRAW (claims matured withdrawals)",
        {
          network: args.network,
          token: args.token,
          staker: args.staker,
        },
        response.data,
      );
    },
  }),
];
