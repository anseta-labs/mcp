import type { StakingNetwork } from "@anseta/typescript-sdk";

export const DEFAULT_BASE_URL = "https://preview.api.stakefi.network";
export const MAX_LIST_ITEMS = 25;
export const MAX_FIELD_CHARS = 300;

/**
 * Per-network argument rules that the OpenAPI `required` array cannot express:
 * SimplifiedStakeRequest lists only network/token/staker, but `validator` is
 * mandatory on most networks and `amount` on all but Cardano.
 *
 * Typed as a total Record so adding a network to the SDK enum fails the build
 * here until it is classified, rather than silently defaulting to the wrong
 * rule and surfacing as an upstream 400.
 *
 * `ethereum` requires a validator because Polygon staking is exposed as network
 * "ethereum" with token "POL" — the POL validator contracts live on Ethereum L1.
 */
export interface NetworkRule {
  validatorRequired: boolean;
  amountRequired: boolean;
}

const VALIDATOR_AND_AMOUNT: NetworkRule = { validatorRequired: true, amountRequired: true };
const AMOUNT_ONLY: NetworkRule = { validatorRequired: false, amountRequired: true };
/** Cardano derives the amount from the wallet's UTxOs, so it takes none. */
const VALIDATOR_ONLY: NetworkRule = { validatorRequired: true, amountRequired: false };

export const NETWORK_RULES: Record<StakingNetwork, NetworkRule> = {
  ethereum: VALIDATOR_AND_AMOUNT,
  solana: VALIDATOR_AND_AMOUNT,
  somnia: VALIDATOR_AND_AMOUNT,
  mantra: VALIDATOR_AND_AMOUNT,
  nillion: VALIDATOR_AND_AMOUNT,
  zenrock: VALIDATOR_AND_AMOUNT,
  kaia: VALIDATOR_AND_AMOUNT,
  cardano: VALIDATOR_ONLY,
  monad: AMOUNT_ONLY,
  sonic: AMOUNT_ONLY,
  near: AMOUNT_ONLY,
  aptos: AMOUNT_ONLY,
  "ethereum-sepolia-testnet": VALIDATOR_AND_AMOUNT,
  "solana-testnet": VALIDATOR_AND_AMOUNT,
  "somnia-testnet": VALIDATOR_AND_AMOUNT,
  "mantra-testnet": VALIDATOR_AND_AMOUNT,
  "nillion-testnet": VALIDATOR_AND_AMOUNT,
  "zenrock-testnet": VALIDATOR_AND_AMOUNT,
  "kaia-kairos-testnet": VALIDATOR_AND_AMOUNT,
  "cardano-testnet": VALIDATOR_ONLY,
  "monad-testnet": AMOUNT_ONLY,
  "sonic-testnet": AMOUNT_ONLY,
  "hedera-testnet": AMOUNT_ONLY,
};
