export const DEFAULT_BASE_URL = "https://preview.api.stakefi.network";
export const MAX_LIST_ITEMS = 25;
export const MAX_FIELD_CHARS = 300;

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
