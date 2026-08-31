import { infoTools } from "./info.js";
import { stakingReadTools } from "./staking-read.js";
import { stakingWriteTools } from "./staking-write.js";
import { restakingReadTools } from "./restaking-read.js";
import { restakingWriteTools } from "./restaking-write.js";
import type { AnsetaTool } from "./types.js";

export const allTools: AnsetaTool[] = [
  ...infoTools,
  ...stakingReadTools,
  ...stakingWriteTools,
  ...restakingReadTools,
  ...restakingWriteTools,
];
export { defineTool } from "./types.js";
export type { AnsetaTool, ToolContext, ToolDefinition, ToolArgs, ToolResult } from "./types.js";
