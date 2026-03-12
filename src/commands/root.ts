import { Command } from "effect/unstable/cli";
import { commandFetch } from "./fetch";
import { commandMap } from "./map";
import { commandMcp } from "./mcp";
import { commandSearch } from "./search";

export const commandRoot = Command.make("ultimate-search").pipe(
  Command.withDescription("CLI entrypoint for search, fetch, map, and MCP workflows."),
  Command.withSubcommands([commandSearch, commandFetch, commandMap, commandMcp]),
);
