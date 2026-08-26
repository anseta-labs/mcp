#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAnsetaServer } from "./server.js";

const apiKey = process.env.ANSETA_API_KEY;
if (!apiKey) {
  // stdout carries the protocol; diagnostics must go to stderr.
  console.error("ANSETA_API_KEY is not set. Add it to the env block of your MCP client config.");
  process.exit(1);
}

const server = createAnsetaServer({ apiKey, baseUrl: process.env.ANSETA_BASE_URL });
await server.connect(new StdioServerTransport());
