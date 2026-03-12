import { Command } from "effect/unstable/cli";
import { makeStubHandler } from "../stub.ts";

export const commandSearchGrok = Command.make("grok").pipe(
  Command.withDescription("Run Grok-backed search."),
  Command.withHandler(makeStubHandler("ultimate-search search grok")),
);
