import { Command } from "effect/unstable/cli";
import { outputFlag } from "../shared/output";
import { makeStubHandler } from "./stub";

export const commandMap = Command.make("map", { output: outputFlag }).pipe(
  Command.withDescription("Map a site's reachable URLs."),
  Command.withHandler(makeStubHandler("ultimate-search map")),
);
