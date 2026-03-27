import { Command } from "effect/unstable/cli";
import { commandFetch } from "./fetch.ts";
import { commandMap } from "./map.ts";
import { commandMcp } from "./mcp.ts";
import { commandSearch } from "./search.ts";

export const commandRoot = Command.make("ultimate-search").pipe(
  Command.withDescription("CLI entrypoint for search, fetch, map, and MCP workflows."),
  Command.withSubcommands([commandSearch, commandFetch, commandMap, commandMcp]),
);
