import { Effect } from "effect";
import { writeStderr } from "../cli/io";
import { CliOutput } from "../shared/output";

const notImplementedMessage = (commandPath: string) =>
  `The '${commandPath}' command is not implemented yet.`;

export const makeStubHandler =
  (commandPath: string, options?: { readonly useCliOutput?: boolean }) => () =>
    Effect.gen(function* () {
      yield* Effect.logDebug(`CLI stub invoked for ${commandPath}`);

      if (options?.useCliOutput === false) {
        yield* writeStderr(notImplementedMessage(commandPath));
        return;
      }

      const cliOutput = yield* CliOutput;
      yield* cliOutput.writeNotImplemented(commandPath);
    });
