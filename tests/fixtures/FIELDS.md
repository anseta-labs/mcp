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
| `operators.json` | `Operator` in `@anseta/typescript-sdk` — the spec types the array items as bare `nullable` |

Every address in them is fabricated or taken from the spec's own examples.

**Re-capture when a key is available:**

```bash
ANSETA_API_KEY=<staging-key> ANSETA_BASE_URL=https://staging-api.stakefi.network \
  pnpm capture:fixtures
```

Then re-run `pnpm exec vitest run tests/fixtures.test.ts`. If it fails, the live field
names differ from the schemas above — **update the projection lists in
`src/tools/` to match the capture, not the other way round**, and open an issue
against the docs repo, because `GET /v1/staking/validators`, `GET /v1/staking/stakes`
and `GET /v1/restaking/operators` are typed as bare `nullable` in the OpenAPI
spec, so the SDK's models are the only typed description of them.

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

Staking and restaking return these same three shapes, so there is **one** copy
of each list, in `src/tools/fields.ts`. Changing a history projection changes
both families at once, which is the intent: the same model should not render
different columns depending on which endpoint produced it.

---

## `/v1/restaking/operators` — item fields

| Field | Keep | Why |
|---|---|---|
| `operatorId` | ✅ | What `get_restaking_daily_rewards` and the history tools take |
| `operatorAddress` | ✅ | What `build_restaking_delegate_tx` and `get_restaking_stakes` take as `operator` |
| `moniker` | ✅ | Operator-supplied display name; sanitized |
| `status` | ✅ | Whether the operator is accepting delegation |
| `protocol` | ✅ | eigenlayer — kept because the field exists for future protocols |
| `commissionRate` | ✅ | The operator's cut, needed to reason about yield |
| `publicDelegationEnabled` | ✅ | Whether a delegate transaction would be accepted at all |
| `services` | ❌ | Array of AVS objects, unbounded per row; 25 operators of them would dominate the result. Add it as its own tool if the AVS set is ever asked for |

---

## `/v1/restaking/stakes` — item fields

Nested under `data.stakes`, like `/v1/staking/stakes`.

| Field | Keep | Why |
|---|---|---|
| `network` | ✅ | Echoes the queried network |
| `token` | ✅ | Which restaked token this row is |
| `tokenAddress` | ✅ | The strategy's underlying token contract |
| `stakerAddress` | ✅ | Whose position this is |
| `operatorAddress` | ✅ | Which operator it is delegated to, absent when undelegated |
| `amount` | ✅ | Base units; the only amount the endpoint returns |
| `status` | ✅ | Drives the next lifecycle step |
| `unstakingCompletionDate` | ✅ | When `build_restaking_withdraw_tx` becomes usable — the ~7-day delay is invisible without it |

`RestakingStake` has no `rewards` field, unlike `Stake`.
