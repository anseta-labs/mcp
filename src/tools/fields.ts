import type {
  DailyRewardItem,
  DelegationHistoryItem,
  RewardHistoryItem,
} from "@anseta/typescript-sdk";

/**
 * Projection lists for the three history shapes, which staking and restaking
 * both return. Keeping one copy is what stops the two families from drifting
 * into showing different columns for the same model.
 *
 * Each is typed `satisfies readonly (keyof Model)[]`, so a name that drifts out
 * of the upstream schema fails the build rather than silently dropping a
 * column. See tests/fixtures/FIELDS.md for why each field is kept or dropped.
 */
export const DELEGATION_FIELDS = [
  "validatorId", "validatorMoniker", "delegatorAddress", "eventType",
  "amountFormatted", "tokenSymbol", "timestamp", "transactionHash", "network",
] as const satisfies readonly (keyof DelegationHistoryItem)[];

export const REWARD_FIELDS = [
  "validatorId", "validatorMoniker", "delegatorAddress",
  "amountFormatted", "tokenSymbol", "timestamp", "transactionHash", "network",
] as const satisfies readonly (keyof RewardHistoryItem)[];

export const DAILY_FIELDS = [
  "validatorId", "validatorMoniker", "date", "totalRewardFormatted",
  "delegatorRewardFormatted", "validatorCommissionFormatted", "tokenSymbol", "network",
] as const satisfies readonly (keyof DailyRewardItem)[];
