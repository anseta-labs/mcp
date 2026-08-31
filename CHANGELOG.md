# Changelog

All notable changes to `@anseta/mcp` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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
