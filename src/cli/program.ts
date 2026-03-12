import { BunServices } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { Command } from "effect/unstable/cli";
import PackageJson from "../../package.json" with { type: "json" };
import { commandRoot } from "../commands/root";
import { CliOutput, cliLoggerLayer } from "../shared/output";
import { TracingLayer } from "../shared/tracing";

const runtimeBaseLayer = Layer.mergeAll(
  BunServices.layer,
  FetchHttpClient.layer,
  cliLoggerLayer,
  TracingLayer,
  Layer.succeed(Logger.LogToStderr, true),
);

const runtimeLayer = Layer.merge(runtimeBaseLayer, CliOutput.layer());

export const runCli = (args: ReadonlyArray<string>) =>
  Command.runWith(commandRoot, {
    version: PackageJson.version,
  })(args).pipe(Effect.provide(runtimeLayer));

export const cliProgram = Command.run(commandRoot, {
  version: PackageJson.version,
}).pipe(Effect.provide(runtimeLayer));
