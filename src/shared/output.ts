import { Effect, Layer, Schema, ServiceMap } from "effect";
import { Flag } from "effect/unstable/cli";
import { writeStderr, writeStdout } from "../cli/io";
import {
  ConfigValidationError,
  ProviderContentError,
  ProviderDecodeError,
  ProviderRequestError,
  ProviderResponseError,
} from "./errors";
import { renderStructuredError } from "./render-error";

const stringify = (value: unknown) => JSON.stringify(value, null, 2);
const maxHumanErrorBodyLength = 500;

export const OutputModeSchema = Schema.Literals(["human", "llm"] as const);
export type OutputMode = typeof OutputModeSchema.Type;

export const outputFlag = Flag.optional(
  Flag.string("output").pipe(
    Flag.mapTryCatch(
      (value): OutputMode => {
        if (value === "human" || value === "llm") {
          return value;
        }

        throw new Error("invalid output mode");
      },
      () => "output must be either 'human' or 'llm'",
    ),
    Flag.withDescription("Output mode: human for readable text, llm for structured JSON."),
  ),
);

type ProcessEnvLike = Readonly<Record<string, string | undefined>>;

const getProcessEnv = (): ProcessEnvLike =>
  "process" in globalThis && typeof globalThis.process === "object" && globalThis.process?.env
    ? globalThis.process.env
    : {};

const trimTrailingWhitespace = (text: string) => text.trimEnd();

const truncate = (text: string, maxLength: number) =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}...`;

const configErrorDetails = (error: ConfigValidationError): Array<string> => {
  const details = Array.isArray(error.details)
    ? error.details.filter((detail) => detail.length > 0)
    : [];

  if (details.length > 0) {
    return details;
  }

  if (error.cause instanceof Error && error.cause.message.length > 0) {
    return [error.cause.message];
  }

  if (typeof error.cause === "string" && error.cause.length > 0) {
    return [error.cause];
  }

  return [];
};

export const writeJsonStdout = (value: unknown) => writeStdout(stringify(value));
export const renderJsonText = (value: unknown) => stringify(value);

export const writeRenderedError = (error: unknown) =>
  writeStderr(stringify({ error: renderStructuredError(error) }));

const resolveOutputModeFromArgs = (
  args: ReadonlyArray<string>,
  env: ProcessEnvLike = getProcessEnv(),
): OutputMode => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--output") {
      const next = args[index + 1];
      if (next === "human" || next === "llm") {
        return next;
      }
      continue;
    }

    if (arg === "--output=human") {
      return "human";
    }

    if (arg === "--output=llm") {
      return "llm";
    }
  }

  return env["AGENT"]?.trim() ? "llm" : "human";
};

const renderHumanError = (error: unknown) => {
  if (error instanceof ConfigValidationError) {
    const details = configErrorDetails(error);
    const lines = [`Configuration error (${error.provider})`, error.message];

    if (details.length > 0) {
      lines.push("", "What to fix:");
      lines.push(...details.map((detail) => `- ${detail}`));
    }

    return trimTrailingWhitespace(lines.join("\n"));
  }

  if (error instanceof ProviderRequestError) {
    return trimTrailingWhitespace([`Request failed (${error.provider})`, error.message].join("\n"));
  }

  if (error instanceof ProviderContentError) {
    return trimTrailingWhitespace(
      [`Provider returned no usable content (${error.provider})`, error.message].join("\n"),
    );
  }

  if (error instanceof ProviderResponseError) {
    const lines = [
      `Provider response error (${error.provider})`,
      error.message,
      `HTTP status: ${error.status}`,
    ];
    const body = error.body.trim();

    if (body.length > 0) {
      lines.push(`Response body: ${truncate(body, maxHumanErrorBodyLength)}`);
    }

    return trimTrailingWhitespace(lines.join("\n"));
  }

  if (error instanceof ProviderDecodeError) {
    return trimTrailingWhitespace(
      [`Provider decode error (${error.provider})`, error.message].join("\n"),
    );
  }

  if (error instanceof Error) {
    return trimTrailingWhitespace([error.name, error.message].join("\n"));
  }

  return `Unknown error\n${String(error)}`;
};

const notImplementedMessage = (commandPath: string) =>
  `The '${commandPath}' command is not implemented yet.`;

const renderHumanNotImplemented = (commandPath: string) =>
  trimTrailingWhitespace(
    [notImplementedMessage(commandPath), "Try '--help' to inspect the command surface."].join("\n"),
  );

export class CliOutput extends ServiceMap.Service<
  CliOutput,
  {
    readonly mode: OutputMode;
    readonly writeOutput: (output: {
      readonly human: string;
      readonly llm: unknown;
    }) => Effect.Effect<void>;
    readonly writeError: (error: unknown) => Effect.Effect<void>;
    readonly writeNotImplemented: (commandPath: string) => Effect.Effect<void>;
  }
>()("CliOutput") {
  static layerForArgs(args: ReadonlyArray<string>, env: ProcessEnvLike = getProcessEnv()) {
    const mode = resolveOutputModeFromArgs(args, env);

    return Layer.succeed(
      CliOutput,
      CliOutput.of({
        mode,
        writeOutput: ({ human, llm }) =>
          mode === "llm" ? writeJsonStdout(llm) : writeStdout(human),
        writeError: (error) =>
          mode === "llm" ? writeRenderedError(error) : writeStderr(renderHumanError(error)),
        writeNotImplemented: (commandPath) =>
          mode === "llm"
            ? writeStderr(
                stringify({
                  error: {
                    type: "NotImplemented",
                    command: commandPath,
                    message: notImplementedMessage(commandPath),
                  },
                }),
              )
            : writeStderr(renderHumanNotImplemented(commandPath)),
      }),
    );
  }
}
