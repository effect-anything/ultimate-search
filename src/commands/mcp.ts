import { Command } from "effect/unstable/cli";
import { commandMcpStdio } from "./mcp/stdio";

export const commandMcp = Command.make("mcp").pipe(
  Command.withDescription("Expose ultimate-search over MCP transports."),
  Command.withSubcommands([commandMcpStdio]),
);
