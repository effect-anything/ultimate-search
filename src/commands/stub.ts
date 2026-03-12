import { Effect } from "effect";
import { writeStderr } from "../cli/io";

const notImplementedMessage = (commandPath: string) =>
  `The '${commandPath}' command is not implemented yet.`;

export const makeStubHandler = (commandPath: string) => () =>
  Effect.gen(function* () {
    yield* Effect.logDebug(`CLI stub invoked for ${commandPath}`);
    yield* writeStderr(notImplementedMessage(commandPath));
  });
