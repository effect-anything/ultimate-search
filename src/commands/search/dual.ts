import { Command } from "effect/unstable/cli";
import { outputFlag } from "../../shared/output";
import { makeStubHandler } from "../stub";

export const commandSearchDual = Command.make("dual", { output: outputFlag }).pipe(
  Command.withDescription("Run Grok and Tavily search together."),
  Command.withHandler(makeStubHandler("ultimate-search search dual")),
);
