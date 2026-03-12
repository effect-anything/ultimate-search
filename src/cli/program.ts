import { BunServices } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";
import * as CliError from "effect/unstable/cli/CliError";
import PackageJson from "../../package.json" with { type: "json" };
import { commandRoot } from "../commands/root";
import { FetchService } from "../shared/fetch";
import { CliOutput } from "../shared/output";

const loggerLayer = Logger.layer([Logger.consolePretty()]);

const runtimeBaseLayer = Layer.mergeAll(
  BunServices.layer,
  FetchService.layer,
  loggerLayer,
  Layer.succeed(Logger.LogToStderr, true),
);

const runtimeLayerForArgs = (args: ReadonlyArray<string>) =>
  Layer.merge(runtimeBaseLayer, CliOutput.layerForArgs(args));

const renderNonCliErrors = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.tapError((error) =>
      CliError.isCliError(error)
        ? Effect.void
        : Effect.gen(function* () {
            const cliOutput = yield* CliOutput;
            yield* cliOutput.writeError(error);
          }),
    ),
  );

export const runCli = (args: ReadonlyArray<string>) =>
  renderNonCliErrors(
    Command.runWith(commandRoot, {
      version: PackageJson.version,
    })(args),
  ).pipe(Effect.provide(runtimeLayerForArgs(args) as never));

const currentProcessArgs = (): ReadonlyArray<string> =>
  "process" in globalThis && Array.isArray(globalThis.process?.argv)
    ? globalThis.process.argv.slice(2)
    : [];

export const cliProgram = Effect.suspend(() => runCli(currentProcessArgs()));
