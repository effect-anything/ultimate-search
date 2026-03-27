import { Effect, Option } from "effect";
import { CliOutput, type OutputMode, resolveOutputMode } from "./output.ts";

export interface CommandOutput {
  readonly human: string;
  readonly llm: unknown;
}

export const runCommandWithOutput = <E, R>(
  selectedMode: Option.Option<OutputMode>,
  buildOutput: (mode: OutputMode) => Effect.Effect<CommandOutput, E, R>,
) =>
  Effect.gen(function* () {
    const cliOutput = yield* CliOutput;
    const mode = resolveOutputMode(selectedMode, cliOutput.defaultMode);
    const output = yield* buildOutput(mode).pipe(
      Effect.tapError((error) => cliOutput.logError(error, mode)),
    );

    yield* cliOutput.writeOutput(output, mode);
  });
