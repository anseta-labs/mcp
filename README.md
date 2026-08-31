# @anseta/mcp

[![ci](https://github.com/anseta-labs/mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/anseta-labs/mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@anseta/mcp.svg)](https://www.npmjs.com/package/@anseta/mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

An MCP server that exposes the [Anseta](https://anseta.com) staking API to AI agents as 22 tools:
discovery of networks, tokens, validators and entities; staking and EigenLayer restaking positions
and reward history; and construction of unsigned staking and restaking transactions.

**It never holds a key and never broadcasts.** The eight `build_*_tx` tools return unsigned
transaction objects for the user to review and sign in their own wallet. Nothing this server does
moves funds.

## Install

Requires Node 20 or newer and an Anseta API key.

### Claude Code

```bash
claude mcp add anseta --env ANSETA_API_KEY=your-key -- npx -y @anseta/mcp
```

### Claude Desktop / Cursor

Add to `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "anseta": {
      "command": "npx",
      "args": ["-y", "@anseta/mcp"],
      "env": { "ANSETA_API_KEY": "your-key" }
    }
  }
}
```

To point at a non-default host, add `"ANSETA_BASE_URL": "https://…"` to the same `env` block. The
default is `https://preview.api.stakefi.network`. Give the bare host: the client adds the `/v1`
prefix itself, and a base URL that still ends in `/v1` is accepted for compatibility with older
configs.

## Tools

| Tool | What it does |
|---|---|
| `list_networks` | Supported networks with type, native token, chain ID, explorer |
| `list_tokens` | Stakeable tokens with **decimals** — needed to build any amount |
| `list_staking_options` | Which network/token pairs are LIVE or PLANNED |
| `list_entities` | Validator organizations behind one or more validators |
| `list_validators` | Validators available for delegation, with commission and status |
| `get_stakes` | A wallet's positions with one specific validator |
| `get_delegation_history` | Delegation and undelegation events for a validator |
| `get_reward_history` | On-chain reward-claim transactions for a validator |
| `get_daily_rewards` | Daily accrual, split into delegator share and commission |
| `build_stake_tx` | Unsigned transactions that delegate to a validator |
| `build_unstake_tx` | Unsigned transactions that **begin** unbonding |
| `build_withdraw_tx` | Unsigned transactions that **claim** finished unbonding or rewards |

`build_unstake_tx` and `build_withdraw_tx` are two distinct lifecycle steps. Unstaking starts the
unbonding period; it does not return tokens to the wallet. Withdrawing claims what has finished
unbonding.

### Restaking (EigenLayer)

Restaking is a separate surface with its own operators, positions and lifecycle. It runs on
Ethereum only (`ethereum`, `ethereum-hoodi-testnet`) and covers `EIGEN`, `BEIGEN`, `STETH`, `CBETH`
and `RETH`.

| Tool | What it does |
|---|---|
| `list_operators` | EigenLayer operators, with protocol, status and commission |
| `get_restaking_stakes` | A wallet's restaked positions with one operator, and withdrawal status |
| `get_restaking_delegation_history` | Delegate and undelegate events for an operator |
| `get_restaking_reward_history` | On-chain reward-claim transactions for an operator |
| `get_restaking_daily_rewards` | Daily accrual, split into delegator share and commission |
| `build_restaking_deposit_tx` | Unsigned approve + depositIntoStrategy transactions |
| `build_restaking_delegate_tx` | Unsigned transactions that delegate the deposit to an operator |
| `build_restaking_unstake_tx` | Unsigned transactions that queue a **partial** withdrawal |
| `build_restaking_undelegate_tx` | Unsigned transactions that queue **everything** and undelegate |
| `build_restaking_withdraw_tx` | Unsigned transactions that **complete** a matured withdrawal |

The restaking lifecycle is four steps, and skipping one silently does nothing:

```
deposit  ->  delegate  ->  unstake (part, stays delegated)  ->  withdraw
                       \-> undelegate (all, ends delegation) -/
                                    ~7 days on mainnet
```

`build_restaking_unstake_tx` withdraws a chosen amount of one token and keeps the delegation.
`build_restaking_undelegate_tx` is all-or-nothing: it queues every restaked asset and ends the
delegation. Both only *queue* a withdrawal — `build_restaking_withdraw_tx` completes it once the
delay has passed, and `get_restaking_stakes` reports the completion date.

## Amounts are base units

Every `amount` argument is a **string in the token's base denomination**, never a decimal token
value:

| Token | Decimals | 1 token as an amount |
|---|---|---|
| SOL | 9 | `"1000000000"` |
| POL | 18 | `"1000000000000000000"` |
| MANTRA | 6 | `"1000000"` |

Call `list_tokens` for a token's `decimals`. The server rejects a non-integer amount before it
reaches the API, and every successful `build_*_tx` result echoes the decoded human-readable amount
next to the transaction so a wrong value is visible without decoding hex.

Note that Polygon staking is addressed as `network: "ethereum"` with `token: "POL"`, because the POL
validator contracts are deployed on Ethereum L1.

## Getting an API key

Request one through your Anseta account contact. The key is sent as an `x-api-key` header; this
server never puts it in a query string.

## Development

```bash
pnpm install
pnpm test           # vitest, no network access — every test injects a stub fetch
pnpm exec tsc --noEmit
pnpm lint
pnpm build          # tsup -> dist/
```

Response fixtures under `tests/fixtures/` are currently derived from the upstream schemas rather
than captured from a live host; see `tests/fixtures/FIELDS.md`. With a staging key:

```bash
ANSETA_API_KEY=<key> ANSETA_BASE_URL=https://staging-api.stakefi.network pnpm capture:fixtures
```

`spec/developer_api.json` is a read-only copy of the Anseta OpenAPI spec, kept as reference for the
tool schemas. Nothing imports it at runtime.

## License

MIT
