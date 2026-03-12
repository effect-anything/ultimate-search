import { Command } from "effect/unstable/cli";
import { commandSearchDual } from "./search/dual";
import { commandSearchGrok } from "./search/grok";
import { commandSearchTavily } from "./search/tavily";

export const commandSearch = Command.make("search").pipe(
  Command.withDescription("Search the web with one or more providers."),
  Command.withSubcommands([commandSearchGrok, commandSearchTavily, commandSearchDual]),
);
