# Fixture field inventory

**Provenance.** These fixtures are *schema-derived*, not captured from a live host.
No staging API key was available when they were written, so each one was built from
the authoritative definition of the response rather than from a recorded call:

| Fixture | Source of truth |
|---|---|
| `validators.json` | `Validator` in `stakefi-developer-api/src/services/staking-data/staking-data-service.ts`, which matches `EntityValidator` in `spec/developer_api.json` |
| `stakes.json` | `StakeSchema` in `stakefi-developer-api/src/validation/staking/get-stakes.ts` |
| `networks.json` | `NetworkConfig` in `spec/developer_api.json` |
| `tokens.json` | `TokenInfo` in `spec/developer_api.json` |
| `stake-tx.json` | `TransactionsResponse` / `Transaction` in `spec/developer_api.json` |

Every address in them is fabricated or taken from the spec's own examples.

**Re-capture when a key is available:**

```bash
ANSETA_API_KEY=<staging-key> ANSETA_BASE_URL=https://staging-api.stakefi.network/v1 \
  npm run capture:fixtures
```

Then re-run `npx vitest run tests/fixtures.test.ts`. If it fails, the live field
names differ from the schemas above — **update the projection lists in
`src/tools/` to match the capture, not the other way round**, and open an issue
against the docs repo, because `GET /v1/staking/validators` and
`GET /v1/staking/stakes` are typed as bare `nullable` in the OpenAPI spec.

---

## `/v1/staking/validators` — item fields

| Field | Keep | Why |
|---|---|---|
| `validatorId` | ✅ | The identifier every history tool takes |
| `validatorAddress` | ✅ | What `build_stake_tx` needs as `validator` |
| `moniker` | ✅ | Operator-supplied display name; sanitized |
| `status` | ✅ | LIVE / PLANNED |
| `network` | ✅ | Nested object carrying `name`, `type`, `tokenSymbol`, `decimals` — the decimals are how a model converts an amount |
| `commissionRate` | ✅ | Directly relevant to a delegation decision |
| `publicDelegationEnabled` | ✅ | Whether delegation is even possible |
| `website` | ✅ | Operator-supplied; sanitized |
| `maxCommissionRate` | ❌ | Governance ceiling, not a delegation input |
| `maxCommissionChangeRate` | ❌ | Same |
| `creationBlockNumber` | ❌ | Block-chain internal, no decision value in a list |
| `ownerAddress` | ❌ | Contract internal |
| `stakingContract` | ❌ | Contract internal |
| `securityContact` | ❌ | Operator-supplied free text, rarely load-bearing |
| `details` | ❌ | Operator-supplied free text, frequently long |

## `/v1/staking/stakes` — item fields

Note: this endpoint returns **raw base-denomination** amounts with no formatted
twin, so `amount` and `rewards` are kept as-is and the tool description tells the
model to convert with the token's `decimals`.

| Field | Keep | Why |
|---|---|---|
| `network` | ✅ | Echoes the queried network |
| `token` | ✅ | Token symbol |
| `tokenAddress` | ✅ | Distinguishes native from contract tokens |
| `stakerAddress` | ✅ | Whose position this is |
| `validatorAddress` | ✅ | Which validator holds it |
| `amount` | ✅ | Base units; the only amount the endpoint returns |
| `status` | ✅ | staked / unstaking / unstaked — drives the next lifecycle step |
| `unstakingCompletionDate` | ✅ | When `build_withdraw_tx` becomes usable |
| `rewards` | ✅ | Base units, accrued and unclaimed |

## History endpoints

Typed completely in the spec (`DelegationHistoryItem`, `RewardHistoryItem`,
`DailyRewardItem`), so no capture is needed. Each carries both `amount` (base
units) and `amountFormatted` (whole tokens); the projections keep the formatted
twin and drop the raw one, plus `blockNumber`, `validatorAddress`, `decimals`,
and `protocol`.
