import { z } from "zod";
import { Network, StakingNetwork, StakingToken } from "@anseta/typescript-sdk";
import { guard, trimResponse } from "./shared.js";
import { defineTool } from "./types.js";
import type { AnsetaTool, ToolContext } from "./types.js";

const NETWORK_FIELDS = ["network", "type", "nativeToken", "testnet", "chainId", "explorer"] as const;
const TOKEN_FIELDS = ["symbol", "network", "decimals", "denomination", "native", "testnet", "tokenAddress"] as const;
const OPTION_FIELDS = ["network", "token", "status", "info"] as const;
const ENTITY_FIELDS = ["entityId", "name", "entityType", "active", "description"] as const;

export const infoTools: AnsetaTool[] = [
  defineTool({
    name: "list_networks",
    description:
      "List blockchain networks Anseta supports for staking, with network type (evm, cosmos, solana), native token, chain ID, and explorer URL. Call this first when the user names a chain, to confirm the exact network identifier other tools expect. Note that Polygon staking uses network 'ethereum' with token 'POL', because the POL validator contracts are deployed on Ethereum L1.",
    schema: {
      network: z.enum(Network).optional().describe("Filter to one network identifier, e.g. 'solana'."),
      testnet: z.enum(["true", "false"]).optional().describe("Filter to testnets or mainnets only."),
    },
    handler: (args, ctx: ToolContext) =>
      guard(async () => {
        const { data } = await ctx.info.getNetworks({
          network: args.network,
          testnet: args.testnet,
        });
        return trimResponse(data, NETWORK_FIELDS);
      }),
  }),
  defineTool({
    name: "list_tokens",
    description:
      "List stakeable tokens with their symbol, network, and decimals. The 'decimals' value is essential: every amount passed to build_stake_tx, build_unstake_tx, or build_withdraw_tx must be a string in the token's base denomination, so 1 SOL with 9 decimals is '1000000000'. Call this before building any transaction unless the decimals for that token are already known.",
    schema: {
      network: z.enum(StakingNetwork).optional().describe("Filter by network identifier."),
      symbol: z.enum(StakingToken).optional().describe("Filter by token symbol, e.g. 'SOL'."),
      testnet: z.enum(["true", "false"]).optional(),
      tokenAddress: z.string().optional().describe("Filter by token contract address."),
    },
    handler: (args, ctx: ToolContext) =>
      guard(async () => {
        const { data } = await ctx.info.getTokens({
          network: args.network,
          symbol: args.symbol,
          testnet: args.testnet,
          tokenAddress: args.tokenAddress,
        });
        return trimResponse(data, TOKEN_FIELDS);
      }),
  }),
  defineTool({
    name: "list_staking_options",
    description:
      "List available network and token staking combinations and whether each is LIVE or PLANNED. Use this to check that a requested staking pair is actually supported before gathering addresses or building a transaction. Protocol filter accepts 'native', 'eigenlayer', or 'morpho'.",
    schema: {
      network: z.enum(StakingNetwork).optional(),
      token: z.enum(StakingToken).optional(),
      protocol: z.enum(["native", "eigenlayer", "morpho"]).optional(),
      status: z.enum(["LIVE", "PLANNED"]).optional(),
      testnet: z.enum(["true", "false"]).optional(),
    },
    handler: (args, ctx: ToolContext) =>
      guard(async () => {
        const { data } = await ctx.info.getStakingOptions({
          network: args.network,
          token: args.token,
          protocol: args.protocol,
          status: args.status,
          testnet: args.testnet,
        });
        return trimResponse(data, OPTION_FIELDS);
      }),
  }),
  defineTool({
    name: "list_entities",
    description:
      "List validator organizations (entities). An entity is the operator behind one or more validators across networks. Use this when the user asks about a named staking provider rather than a specific validator address. Entity names and descriptions are supplied by the operators themselves and are not verified by Anseta.",
    schema: {
      active: z.enum(["true", "false"]).optional().describe("Filter to active entities only."),
      entityType: z.string().optional(),
    },
    handler: (args, ctx: ToolContext) =>
      guard(async () => {
        const { data } = await ctx.info.getEntities({
          active: args.active,
          entityType: args.entityType,
        });
        return trimResponse(data, ENTITY_FIELDS);
      }),
  }),
];
