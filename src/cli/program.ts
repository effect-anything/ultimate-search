import {
  Console,
  Effect,
  FileSystem,
  Layer,
  Logger,
  Path,
  Sink,
  Stdio,
  Stream,
  Terminal,
} from "effect";
import { Command } from "effect/unstable/cli";
import * as CliError from "effect/unstable/cli/CliError";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import PackageJson from "../../package.json" with { type: "json" };
import { commandRoot } from "../commands/root";
import { FetchService } from "../shared/fetch";
import { writeRenderedError } from "../shared/output";

const loggerLayer = Logger.layer([Logger.consolePretty()]);
const textDecoder = new TextDecoder();

const consoleStdioLayer = Layer.succeed(
  Stdio.Stdio,
  Stdio.make({
    args: Effect.sync(() =>
      "process" in globalThis && Array.isArray(globalThis.process?.argv)
        ? globalThis.process.argv.slice(2)
        : [],
    ),
    stdout: () =>
      Sink.forEach((chunk: string | Uint8Array) =>
        Console.log(typeof chunk === "string" ? chunk : textDecoder.decode(chunk)),
      ),
    stderr: () =>
      Sink.forEach((chunk: string | Uint8Array) =>
        Console.error(typeof chunk === "string" ? chunk : textDecoder.decode(chunk)),
      ),
    stdin: Stream.empty,
  }),
);

const childProcessLayer = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make(() =>
    Effect.die("Child processes are not available in this CLI runtime"),
  ),
);

const terminalLayer = Layer.succeed(Terminal.Terminal, {
  columns: Effect.succeed(80),
  rows: Effect.succeed(24),
  isTTY: Effect.succeed(false),
  readInput: Effect.die("Terminal.readInput is not available in this CLI runtime"),
  readLine: Effect.die("Terminal.readLine is not available in this CLI runtime"),
  display: () => Effect.void,
} as unknown as Terminal.Terminal);

const runtimeLayer = Layer.mergeAll(
  Path.layer,
  FileSystem.layerNoop({}),
  terminalLayer,
  FetchService.layer,
  consoleStdioLayer,
  childProcessLayer,
  loggerLayer,
  Layer.succeed(Logger.LogToStderr, true),
);

const renderNonCliErrors = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.tapError((error) =>
      CliError.isCliError(error) ? Effect.void : writeRenderedError(error),
    ),
  );

export const runCli = (args: ReadonlyArray<string>) =>
  renderNonCliErrors(
    Command.runWith(commandRoot, {
      version: PackageJson.version,
    })(args),
  ).pipe(Effect.provide(runtimeLayer as never));

export const cliProgram = renderNonCliErrors(
  commandRoot.pipe(
    Command.run({
      version: PackageJson.version,
    }),
  ),
).pipe(Effect.provide(runtimeLayer as never));
