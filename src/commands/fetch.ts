import { Command } from "effect/unstable/cli";
import { outputFlag } from "../shared/output";
import { makeStubHandler } from "./stub";

export const commandFetch = Command.make("fetch", { output: outputFlag }).pipe(
  Command.withDescription("Fetch and normalize page content from a URL."),
  Command.withHandler(makeStubHandler("ultimate-search fetch")),
);
