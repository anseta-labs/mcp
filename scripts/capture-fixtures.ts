/**
 * Dev-only: record live API responses into tests/fixtures/.
 *
 *   ANSETA_API_KEY=<key> ANSETA_BASE_URL=https://staging-api.stakefi.network npm run capture:fixtures
 *
 * Captured files replace the schema-derived placeholders. Redact any address
 * belonging to a real user before committing, and update tests/fixtures/FIELDS.md.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { createApis } from "../src/client.js";

const apiKey = process.env.ANSETA_API_KEY;
if (!apiKey) throw new Error("Set ANSETA_API_KEY to capture fixtures");

const { info, staking } = createApis({ apiKey, baseUrl: process.env.ANSETA_BASE_URL });

const captures: Array<[string, () => Promise<unknown>]> = [
  ["networks", async () => (await info.getNetworks({})).data],
  ["tokens", async () => (await info.getTokens({ network: "solana" })).data],
  ["entities", async () => (await info.getEntities({})).data],
  ["staking-options", async () => (await info.getStakingOptions({})).data],
  ["validators", async () => (await staking.getValidators({ network: "solana" })).data],
];

mkdirSync("tests/fixtures", { recursive: true });
for (const [name, capture] of captures) {
  try {
    writeFileSync(`tests/fixtures/${name}.json`, JSON.stringify(await capture(), null, 2));
    console.log(`captured ${name}`);
  } catch (error) {
    console.error(`FAILED ${name}:`, error instanceof Error ? error.message : error);
  }
}
