import { Command } from "effect/unstable/cli";
import { makeStubHandler } from "./stub";

export const commandMap = Command.make("map").pipe(
  Command.withDescription("Map a site's reachable URLs."),
  Command.withHandler(makeStubHandler("ultimate-search map")),
);
