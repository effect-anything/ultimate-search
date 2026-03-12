import { Command } from "effect/unstable/cli";
import { makeStubHandler } from "../stub.ts";

export const commandMcpStdio = Command.make("stdio").pipe(
  Command.withDescription("Serve the MCP protocol over stdio."),
  Command.withHandler(makeStubHandler("ultimate-search mcp stdio")),
);
