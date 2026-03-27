import { Cause, Effect, Layer } from "effect";
import { McpServer } from "effect/unstable/ai";
import { Command } from "effect/unstable/cli";
import PackageJson from "../../../package.json" with { type: "json" };
import {
  readOnlyMcpRegistrationLayer,
  readOnlyMcpServicesLayer,
} from "../../services/read-only-mcp.ts";

const mcpStdioServerLayer = readOnlyMcpRegistrationLayer.pipe(
  Layer.provideMerge(
    McpServer.layerStdio({
      name: "ultimate-search",
      version: PackageJson.version,
    }),
  ),
  Layer.provideMerge(readOnlyMcpServicesLayer),
);

export const commandMcpStdio = Command.make("stdio").pipe(
  Command.withDescription("Serve the MCP protocol over stdio."),
  Command.withHandler(() =>
    Layer.launch(mcpStdioServerLayer).pipe(
      Effect.catchCauseIf(Cause.hasInterruptsOnly, () => Effect.void),
    ),
  ),
);
