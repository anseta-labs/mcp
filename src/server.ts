import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { AnsetaClient } from "./client.js";
import { allTools } from "./tools/index.js";

export interface ServerConfig { apiKey: string; baseUrl?: string }

/**
 * Builds the MCP server with all 12 tools registered. Transport-agnostic on
 * purpose: the stdio binary and any future hosted HTTP service both call this.
 */
export function createAnsetaServer(config: ServerConfig): McpServer {
  const client = new AnsetaClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  const server = new McpServer({ name: "anseta", version: pkg.version });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      (args) => tool.handler(args as Record<string, unknown>, { client }),
    );
  }
  return server;
}
