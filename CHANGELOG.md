# Changelog

All notable changes to `@anseta/mcp` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.2.0 - 2026-08-31

Adds EigenLayer restaking, and moves the server onto the generated API client.

### Added

- Restaking data: `list_operators`, `get_restaking_stakes`,
  `get_restaking_delegation_history`, `get_restaking_reward_history`,
  `get_restaking_daily_rewards`
- Restaking transaction building: `build_restaking_deposit_tx`,
  `build_restaking_delegate_tx`, `build_restaking_unstake_tx`,
  `build_restaking_undelegate_tx`, `build_restaking_withdraw_tx`, all returning
  unsigned transactions. The four-step deposit / delegate / unstake or
  undelegate / withdraw lifecycle is described in each tool's own text, since
  skipping a step silently does nothing

### Changed

- Calls go through `@anseta/typescript-sdk` instead of a hand-rolled client, so
  responses are typed and the network and token enums come from the SDK rather
  than from local copies that could drift
- Tool arguments are inferred from each tool's schema, removing the type
  assertions handlers previously used to read them
- `ANSETA_BASE_URL` now takes the bare host; the client adds the `/v1` prefix.
  A URL that still ends in `/v1` keeps working

### Fixed

- `get_stakes` returned no positions for a wallet that held them: the endpoint
  nests its array under `data.stakes` and the projection was reading the
  envelope
- The three history tools failed on every call. Their `limit` argument
  transformed a number to a string, and since the host parses arguments before
  the handler parses them again, the second pass rejected the first pass's own
  output
- A `200` response carrying `success: false` was treated as success, so a failed
  read reported an empty list and a failed transaction build reported a
  transaction ready to sign
- `build_withdraw_tx` demanded an `amount` on networks whose staking requires
  one, rejecting valid withdrawals; withdrawal claims whatever is available
- Connectivity failures reported the SDK's wrapper text instead of the cause,
  losing the reason a host could not be reached
- `decimals` is optional again on the transaction builders. It only decorates
  the review line, so requiring it rejected calls the API would have accepted,
  including Cardano stakes, which carry no amount at all

## 0.1.0 - 2026-08-31

First release. An MCP server exposing the Anseta Developer API as twelve tools
for AI clients, run locally over stdio.

### Added

- Discovery: `list_networks`, `list_tokens`, `list_staking_options`,
  `list_entities`
- Staking data: `list_validators`, `get_stakes`, `get_delegation_history`,
  `get_reward_history`, `get_daily_rewards`
- Transaction building: `build_stake_tx`, `build_unstake_tx`,
  `build_withdraw_tx`, all returning unsigned transactions
