import { Command } from "effect/unstable/cli";
import { makeStubHandler } from "../stub";

export const commandSearchDual = Command.make("dual").pipe(
  Command.withDescription("Run Grok and Tavily search together."),
  Command.withHandler(makeStubHandler("ultimate-search search dual")),
);
