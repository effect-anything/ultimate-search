import { Effect, Exit } from "effect";
import { cliProgram } from "./cli/program.ts";

const exit = await Effect.runPromiseExit(
  cliProgram as Effect.Effect<void, unknown, never>,
);

if (Exit.isFailure(exit)) {
  process.exit(1);
}
