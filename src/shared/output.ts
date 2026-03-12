import { Config, Effect, Layer, Logger, Option, Schema, ServiceMap, Console } from "effect";
import { Flag } from "effect/unstable/cli";
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
  Flag.choice("output", OutputModeSchema.literals).pipe(
    Flag.withDescription("Output mode: human for readable text, llm for structured JSON."),
  ),
);

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

export const writeJsonStdout = (value: unknown) => Console.log(stringify(value));
export const renderJsonText = (value: unknown) => stringify(value);

const defaultOutputModeConfig = Config.string("AGENT").pipe(
  Config.withDefault(""),
  Config.map((agent): OutputMode => (agent.trim().length > 0 ? "llm" : "human")),
);

export const resolveOutputMode = (
  selected: Option.Option<OutputMode>,
  fallback: OutputMode,
): OutputMode => Option.getOrElse(selected, () => fallback);

const makeCliOutput = (defaultMode: OutputMode) =>
  CliOutput.of({
    defaultMode,
    writeOutput: ({ human, llm }, mode = defaultMode) =>
      mode === "llm" ? writeJsonStdout(llm) : Console.log(human),
    logError: (error, mode = defaultMode) => logCliError(error, mode),
  });

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

const cliErrorLogMessageTag = "UltimateSearchCliError";

interface CliErrorLogMessage {
  readonly _tag: typeof cliErrorLogMessageTag;
  readonly mode: OutputMode;
  readonly error: unknown;
}

const isCliErrorLogMessage = (value: unknown): value is CliErrorLogMessage =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  value._tag === cliErrorLogMessageTag &&
  "mode" in value &&
  (value.mode === "human" || value.mode === "llm") &&
  "error" in value;

const normalizeLogMessage = (message: unknown): unknown =>
  Array.isArray(message) && message.length === 1 ? message[0] : message;

const renderGenericLogMessage = (message: unknown): string => {
  const normalized = normalizeLogMessage(message);

  if (Array.isArray(normalized)) {
    return normalized.map((item) => renderGenericLogMessage(item)).join(" ");
  }

  if (typeof normalized === "string") {
    return normalized;
  }

  if (normalized instanceof Error) {
    return trimTrailingWhitespace([normalized.name, normalized.message].join("\n"));
  }

  try {
    return stringify(normalized);
  } catch {
    return String(normalized);
  }
};

const formatCliLogMessage = (message: unknown): string => {
  const normalized = normalizeLogMessage(message);

  if (isCliErrorLogMessage(normalized)) {
    return normalized.mode === "llm"
      ? stringify({ error: renderStructuredError(normalized.error) })
      : renderHumanError(normalized.error);
  }

  return renderGenericLogMessage(normalized);
};

export const logCliError = (error: unknown, mode: OutputMode) =>
  Effect.logError({
    _tag: cliErrorLogMessageTag,
    mode,
    error,
  } satisfies CliErrorLogMessage);

const cliConsoleLogger = Logger.withConsoleError(
  Logger.make((options) => formatCliLogMessage(options.message)),
);

export const cliLoggerLayer = Logger.layer([cliConsoleLogger, Logger.tracerLogger]);

export class CliOutput extends ServiceMap.Service<
  CliOutput,
  {
    readonly defaultMode: OutputMode;
    readonly writeOutput: (
      output: {
        readonly human: string;
        readonly llm: unknown;
      },
      mode?: OutputMode,
    ) => Effect.Effect<void>;
    readonly logError: (error: unknown, mode?: OutputMode) => Effect.Effect<void>;
  }
>()("CliOutput") {
  static readonly layer = Layer.effect(
    CliOutput,
    Effect.map(defaultOutputModeConfig.asEffect(), makeCliOutput),
  );

  static layerForMode(mode: OutputMode) {
    return Layer.succeed(CliOutput, makeCliOutput(mode));
  }
}
