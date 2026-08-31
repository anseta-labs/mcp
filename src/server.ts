import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { createApis } from "./client.js";
import { allTools } from "./tools/index.js";

export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
  /** Injectable transport, so the registered tools can be exercised offline. */
  fetchImpl?: typeof fetch;
}

/**
 * Builds the MCP server with all 12 tools registered. Transport-agnostic on
 * purpose: the stdio binary and any future hosted HTTP service both call this.
 */
export function createAnsetaServer(config: ServerConfig): McpServer {
  const apis = createApis({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    fetchImpl: config.fetchImpl,
  });
  const server = new McpServer({ name: "anseta", version: pkg.version });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      (args) => tool.handler(args, apis),
    );
  }
  return server;
}
