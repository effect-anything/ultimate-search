import { Command } from "effect/unstable/cli";
import { makeStubHandler } from "./stub";

export const commandFetch = Command.make("fetch").pipe(
  Command.withDescription("Fetch and normalize page content from a URL."),
  Command.withHandler(makeStubHandler("ultimate-search fetch")),
);
