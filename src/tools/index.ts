import { infoTools } from "./info.js";
import { stakingReadTools } from "./staking-read.js";
import { stakingWriteTools } from "./staking-write.js";
import type { AnsetaTool } from "./types.js";

export const allTools: AnsetaTool[] = [...infoTools, ...stakingReadTools, ...stakingWriteTools];
export type { AnsetaTool, ToolContext, ToolResult } from "./types.js";
