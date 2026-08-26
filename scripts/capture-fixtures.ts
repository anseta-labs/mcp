/**
 * Dev-only: record live API responses into tests/fixtures/.
 *
 *   ANSETA_API_KEY=<key> ANSETA_BASE_URL=https://staging-api.stakefi.network/v1 \
 *     npm run capture:fixtures
 *
 * Captured files replace the schema-derived placeholders. Redact any address
 * belonging to a real user before committing, and update tests/fixtures/FIELDS.md.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { AnsetaClient } from "../src/client.js";

const apiKey = process.env.ANSETA_API_KEY;
if (!apiKey) throw new Error("Set ANSETA_API_KEY to capture fixtures");

const client = new AnsetaClient({ apiKey, baseUrl: process.env.ANSETA_BASE_URL });

const captures: Array<[string, () => Promise<unknown>]> = [
  ["networks", () => client.get("/info/networks")],
  ["tokens", () => client.get("/info/tokens", { network: "solana" })],
  ["validators", () => client.get("/staking/validators", { network: "solana" })],
  ["entities", () => client.get("/info/entities")],
  ["staking-options", () => client.get("/info/staking-options")],
];

mkdirSync("tests/fixtures", { recursive: true });
for (const [name, fn] of captures) {
  try {
    const data = await fn();
    writeFileSync(`tests/fixtures/${name}.json`, JSON.stringify(data, null, 2));
    console.log(`captured ${name}`);
  } catch (error) {
    console.error(`FAILED ${name}:`, error instanceof Error ? error.message : error);
  }
}
