import {
  APIInfoApi,
  Configuration,
  EigenlayerRestakingApi,
  SimpleStakingApi,
} from "@anseta/typescript-sdk";
import { DEFAULT_BASE_URL } from "./constants.js";

export interface AnsetaClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * The generated clients the tools use. Tools depend on this rather than on the
 * concrete API classes so a test can supply only the methods it needs.
 */
export interface AnsetaApis {
  info: Pick<
    APIInfoApi,
    "getNetworks" | "getTokens" | "getStakingOptions" | "getEntities"
  >;
  staking: Pick<
    SimpleStakingApi,
    | "getValidators"
    | "getStakingPositions"
    | "getStakingDelegationHistory"
    | "getStakingRewardHistory"
    | "getStakingDailyRewards"
    | "createStake"
    | "createUnstake"
    | "createStakingWithdrawal"
  >;
  restaking: Pick<
    EigenlayerRestakingApi,
    | "getRestakingOperators"
    | "getRestakingPositions"
    | "getRestakingDelegationHistory"
    | "getRestakingRewardHistory"
    | "getRestakingDailyRewards"
    | "createRestakingDeposit"
    | "createRestakingDelegation"
    | "createRestakingUnstake"
    | "createRestakingUndelegation"
    | "createRestakingWithdrawal"
  >;
}

/**
 * The SDK builds paths that already carry the `/v1` prefix, so its basePath is
 * the bare host. Earlier versions of this server took a base URL ending in
 * `/v1`, so that suffix is dropped rather than producing `/v1/v1/...`.
 */
function toBasePath(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function createApis(options: AnsetaClientOptions): AnsetaApis {
  if (!options.apiKey) {
    throw new Error("ANSETA_API_KEY is required");
  }

  const configuration = new Configuration({
    basePath: toBasePath(options.baseUrl ?? DEFAULT_BASE_URL),
    apiKey: options.apiKey,
    ...(options.fetchImpl ? { fetchApi: options.fetchImpl } : {}),
  });

  return {
    info: new APIInfoApi(configuration),
    staking: new SimpleStakingApi(configuration),
    restaking: new EigenlayerRestakingApi(configuration),
  };
}
