import { Command } from "effect/unstable/cli";
import { commandSearchDual } from "./search/dual.ts";
import { commandSearchGrok } from "./search/grok.ts";
import { commandSearchTavily } from "./search/tavily.ts";

export const commandSearch = Command.make("search").pipe(
  Command.withDescription("Search the web with one or more providers."),
  Command.withSubcommands([
    commandSearchGrok,
    commandSearchTavily,
    commandSearchDual,
  ]),
);
