import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { cliProgram } from "./cli/program";

BunRuntime.runMain(cliProgram as Effect.Effect<void, unknown, never>, {
  disableErrorReporting: true,
});
