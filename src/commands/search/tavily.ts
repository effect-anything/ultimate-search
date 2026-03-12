import { Command } from "effect/unstable/cli";
import { makeStubHandler } from "../stub.ts";

export const commandSearchTavily = Command.make("tavily").pipe(
  Command.withDescription("Run Tavily-backed search."),
  Command.withHandler(makeStubHandler("ultimate-search search tavily")),
);
