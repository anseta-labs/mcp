export const DEFAULT_BASE_URL = "https://preview.api.stakefi.network/v1";
export const MAX_LIST_ITEMS = 25;
export const MAX_FIELD_CHARS = 300;

/** Networks accepted by GET /v1/staking/stakes — a subset of the full network list. */
export const STAKES_NETWORKS = [
  "ethereum", "solana", "somnia", "monad", "mantra", "nillion", "kaia",
  "cardano", "sonic", "near", "aptos", "zenrock",
  "solana-testnet", "sonic-testnet", "somnia-testnet",
  "ethereum-sepolia-testnet", "mantra-testnet", "monad-testnet",
  "hedera-testnet", "nillion-testnet", "kaia-kairos-testnet",
  "cardano-testnet", "zenrock-testnet",
] as const;

/** Tokens accepted by GET /v1/staking/stakes. */
export const STAKES_TOKENS = [
  "POL", "SOL", "SOMI", "MON", "MANTRA", "NILL", "KAIA",
  "ADA", "S", "NEAR", "APT", "ROCK", "HBAR",
] as const;

/**
 * Networks where SimplifiedStakeRequest.validator is mandatory. The OpenAPI
 * `required` array lists only network/token/staker, so this is enforced here.
 *
 * `ethereum` is on this list because Polygon staking is exposed as
 * network "ethereum" with token "POL" — the POL validator contracts live on
 * Ethereum L1.
 */
export const VALIDATOR_REQUIRED_NETWORKS = [
  "mantra", "nillion", "zenrock", "solana", "cardano",
  "ethereum", "kaia", "somnia",
  "mantra-testnet", "nillion-testnet", "zenrock-testnet",
  "solana-testnet", "cardano-testnet",
  "ethereum-sepolia-testnet", "kaia-kairos-testnet", "somnia-testnet",
] as const;

/** The only network where amount is optional. */
export const AMOUNT_OPTIONAL_NETWORKS = ["cardano", "cardano-testnet"] as const;
