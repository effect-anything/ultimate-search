import { Command } from "effect/unstable/cli";
import { makeStubHandler } from "../stub";

export const commandMcpStdio = Command.make("stdio").pipe(
  Command.withDescription("Serve the MCP protocol over stdio."),
  Command.withHandler(makeStubHandler("ultimate-search mcp stdio", { useCliOutput: false })),
);
