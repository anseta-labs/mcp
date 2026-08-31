# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm test                             # vitest run, all tests
pnpm exec vitest run tests/tools/info.test.ts   # a single test file
pnpm exec vitest run -t "rejects a network"     # a single test by name
pnpm exec tsc --noEmit                # typecheck src
pnpm exec tsc -p tsconfig.test.json   # typecheck src + tests + scripts (CI runs both)
pnpm lint                             # eslint, incl. bans on `any` and type assertions
pnpm build                            # tsup -> dist/ (esm + .d.ts)
```

This project uses **pnpm** (`packageManager` pins the version); do not use npm or yarn.
CI runs, in order: `tsc --noEmit`, `tsc -p tsconfig.test.json`, `eslint .`, `vitest run`, `tsup`. Match that
before pushing. Tests never touch the network — every test injects stub SDK methods via
`tests/support.ts`; a test that hits a real host is a bug.

## Architecture

An MCP server exposing the Anseta staking and EigenLayer restaking API as 22 tools. Layering,
outermost first:

- `src/stdio.ts` — the `anseta-mcp` binary. Reads `ANSETA_API_KEY` / `ANSETA_BASE_URL` from env.
  stdout carries the MCP protocol, so all diagnostics go to stderr.
- `src/server.ts` — `createAnsetaServer()` registers `allTools` on an `McpServer`. Deliberately
  transport-agnostic; the stdio binary and any future HTTP host both call it.
- `src/client.ts` — wraps `@anseta/typescript-sdk` into `AnsetaApis`
  (`{ info, staking, restaking }`), the *only* thing tools depend on. `AnsetaApis` is `Pick<>`ed
  down to the methods actually used, so a test can stub a single method. `fetchImpl` is injectable,
  which is what lets `tests/server.test.ts` drive the whole stack offline.
- `src/tools/*.ts` — the tool definitions, grouped as info / staking-read / staking-write /
  restaking-read / restaking-write. `args.ts` (shared zod argument builders), `fields.ts` (the three
  history projection lists both domains return) and `review.ts` (the `REVIEW BEFORE SIGNING` block
  every `build_*_tx` returns) are shared between those groups — put anything both families need
  there rather than importing across sibling tool modules.
- `src/output.ts`, `src/errors.ts` — output shaping and error translation.

### Tool definitions

Every tool is written with `defineTool()` (`src/tools/types.ts`). It parses args through
`z.object(schema)` at the boundary, so handlers receive `z.infer`red arguments and need **no type
assertions**. The registry type `AnsetaTool` erases the arg type; keep the concrete type inside the
handler by always going through `defineTool`, never by constructing an `AnsetaTool` literal.

`defineTool` also owns the error boundary: it parses the arguments and catches everything the
handler throws, so a bad argument, an upstream error and a transport failure all reach the model as
readable text. Handlers therefore contain no try/catch of their own and end with
`trimResponse(response.data, FIELDS)` for lists.

**A handler has exactly one way to fail: it throws.** It never returns an `errorResult` itself.
There are three kinds of throw, and `defineTool` words each one:

| Thrown | Comes from | Reaches the model as |
|---|---|---|
| `z.ZodError` | the schema, on shape or format | `Invalid arguments for <tool>: …` |
| `ToolArgumentError` | a rule the JSON Schema cannot express, e.g. `NETWORK_RULES` | its own message, verbatim |
| anything else | the SDK, the network, a bug | `toAnsetaError().toModelMessage()` |

That uniformity is the point: every handler body reads as a straight line of guard, call, guard,
return, with no mixture of `return errorResult(...)` in one branch and `throw` in another. Add a new
failure mode by throwing, and give it a case here if it needs different wording.

Argument rules are *not* folded into the zod schema with `.superRefine`. They could be, but
`McpServer` parses from the raw shape and would not run the refinement, so the schema and
`tool.parser` would disagree about what is valid — and the prose that makes these messages useful
("Call list_validators with network='solana' to find one") reads better outside a validation error.

`McpServer` validates arguments against `inputSchema` and passes the **parsed** result to the
handler, which `defineTool` then parses a second time. Schemas here must therefore be
**parse-idempotent**: no `.transform()` that changes a field's type (`z.number().transform(String)`
would reject its own valid output on the second pass and break the tool for every caller). Convert
types inside the handler instead. `tests/server.test.ts` drives a real `Client` over
`InMemoryTransport` to cover that round trip — a test that calls `tool.handler` directly cannot.

### Output discipline (the reason most of this code exists)

Tool output is model context, so it is shaped rather than passed through:

- **Projection.** Each list tool declares an explicit `*_FIELDS` array, typed
  `satisfies readonly (keyof SdkModel)[]`, so a field name that drifts out of the upstream schema
  fails the build instead of silently dropping a column. `project()` returns `Partial<Pick<…>>`
  because absent fields are omitted. `tests/fixtures/FIELDS.md` records the keep/drop rationale —
  update it when a field list changes.
- **Sanitization.** Validator monikers, entity names, websites and descriptions are operator-supplied
  and untrusted. `sanitize()` strips control characters and caps strings at `MAX_FIELD_CHARS`.
- **Capping.** Lists are truncated to `MAX_LIST_ITEMS` (25) with a note telling the model to narrow
  filters.
- **Errors.** `AnsetaApiError.toModelMessage()` maps each status to text that says *whether retrying
  helps* (400 → fix args; 401 → don't retry, report; 429 → back off; status 0 → connectivity). Keep
  that property when adding cases.
- **A 2xx can still be a failure.** The API's envelope carries `success`, and the generated client
  does not look at it, so every handler guards its own call on the lines after it:

  ```ts
  const response = await ctx.info.getNetworks({ ... });
  if (response.success === false) {
    throw parseErrorBody(200, response);
  }
  ```

  Without that guard a failed read reads as an empty list and a failed `build_*_tx` reads as a
  transaction ready to sign. It is repeated per call site rather than hidden in a helper that wraps
  the `await`.

### Domain invariants

- **Never holds a key, never broadcasts.** The eight `build_*_tx` tools return unsigned transactions
  plus a `REVIEW BEFORE SIGNING` block, rendered by the single `buildTxResult()` in
  `src/tools/review.ts` so the two families cannot drift apart on the wording. The promise is also
  asserted on every write tool's *description*, since that is all the model sees when choosing.
  Do not add signing, key handling, or broadcast.
- **Amounts are integer strings in base denomination**, never numbers or decimals — base units exceed
  the exact-integer range of a JS number. The schema's regex rejects both, with a message telling the
  model to call `list_tokens` for `decimals`; `checkNetworkRules()` then applies the per-network
  requirement. The `decimals` tool argument exists only so the result can echo a human-readable
  amount; it is never sent to the API, and stays optional so its absence degrades that one review
  line rather than failing a call the API would have accepted.
- **Conditional requirements the OpenAPI `required` array cannot express** live in
  `NETWORK_RULES` (`src/constants.ts`), a total `Record<StakingNetwork, NetworkRule>`. It is
  exhaustive on purpose: a network added to the SDK enum fails the build until it is classified.
- **Polygon staking is `network: "ethereum"` with `token: "POL"`** — the POL validator contracts are
  on Ethereum L1. This surprises people; the tool descriptions say so on purpose.
- `build_unstake_tx` (begins unbonding) and `build_withdraw_tx` (claims what has finished unbonding)
  are two distinct lifecycle steps, not alternatives.
- `get_stakes` and `get_restaking_stakes` nest their arrays under `data.stakes`, unlike every other
  list endpoint.
- **Restaking is a separate surface**, EigenLayer on Ethereum only (`RestakingNetwork`,
  `RestakingToken`). Its lifecycle is four steps and each is its own endpoint: `deposit` (moves
  tokens into a strategy and earns nothing on its own) → `delegate` (one operator at a time) →
  `unstake` (partial, delegation kept) *or* `undelegate` (ALL assets, delegation ended) → after
  ~7 days on mainnet, `withdraw`. Unlike staking there are no conditional per-network argument
  rules, so the zod schemas are the whole of the validation and there is no `NETWORK_RULES`
  equivalent.
- The restaking history routes take the operator id in a path parameter the spec still calls
  `validatorId`. The tools expose it as `operatorId`, which is what `list_operators` returns, and
  map it at the call site.

### Base URL

`DEFAULT_BASE_URL` is the bare host; the SDK already prefixes `/v1`. `toBasePath()` strips a trailing
`/v1` from a supplied `ANSETA_BASE_URL` for compatibility with older configs that included it, so
both forms work.

### Tool descriptions are the interface

The description strings are the model-facing API and carry real behavioral load: which tool to call
first, that amounts are base units, that names are unverified, that nothing is broadcast. Treat
edits to them as interface changes, and note that several tests assert on their content.

## Type discipline

`src/` contains no `any` and no type assertions, and eslint enforces both
(`consistent-type-assertions: never`). When something does not typecheck, fix the widening at its
source rather than asserting downstream — most of the assertions this code used to carry came from
declaring `z.string()` where the SDK had an enum. Two deliberate exceptions, both commented:
`sanitize`'s overload pair, and `ToolResult` being a type alias rather than an interface (an alias
gets the implicit index signature that makes it assignable to the SDK's `CallToolResult`).

`exactOptionalPropertyTypes` is intentionally **off**: turning it on would force conditional-spread
ceremony (`...(x ? {x} : {})`) back into the request bodies, which serialize identically because
`JSON.stringify` drops undefined properties.

## Known stale

- `tests/fixtures/*.json` are schema-derived, not captured from a live host. If a real capture ever
  contradicts them, update the projections in `src/tools/` to match the capture, not the reverse.

`spec/developer_api.json` is a read-only reference copy of the Anseta OpenAPI spec. Nothing imports
it at runtime.

## Code Style

- Don't condense code too much. Avoid oneliners and try to leave blank lines between code blocks if they 
are not related
- **Every `if` / `for` / `while` body gets braces and its own line**, including one-statement guard
  clauses. `if (x) return y;` is a oneliner; write it as:

  ```ts
  if (x) {
    return y;
  }
  ```

  This is enforced, not conventional: eslint's `curly: ["error", "all"]`. Note that `--fix` only
  inserts the braces (`if (x) {return y;}`) — it will not break the line, because that is a
  formatter's job and there is no formatter here. Put the newline in by hand.

### Where a rule belongs

There is **no formatter** in this repo — no Prettier, Biome, dprint or `.editorconfig`. eslint is
the only automated enforcement, so:

- **Anything mechanically checkable goes in `eslint.config.js`**, style included. That is where
  `curly` lives, next to the type-honesty rules (`no-explicit-any`, `consistent-type-assertions`).
  Adding a rule there is preferred over writing it down here, because a rule only in this file is a
  rule that gets forgotten.
- **This file carries the rules a linter cannot express** — the judgement calls: how much to
  condense, what a tool description must promise, which field to project. Rules that live here are
  documented *with their reason*, so a future change knows what it would be breaking.
- Prettier has deliberately **not** been adopted: it would reflow the projection field lists, which
  are grouped by line on purpose, and fight the "don't condense" rule above. If that trade ever
  changes, adopt it in its own commit so the reformat is separable from real changes.
