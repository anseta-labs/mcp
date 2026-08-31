import { infoTools } from "./info.js";
import { stakingReadTools } from "./staking-read.js";
import { stakingWriteTools } from "./staking-write.js";
import type { AnsetaTool } from "./types.js";

export const allTools: AnsetaTool[] = [...infoTools, ...stakingReadTools, ...stakingWriteTools];
export { defineTool } from "./types.js";
export type { AnsetaTool, ToolContext, ToolDefinition, ToolArgs, ToolResult } from "./types.js";
