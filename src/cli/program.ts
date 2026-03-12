import { BunServices } from "@effect/platform-bun";
import { Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";
import PackageJson from "../../package.json" with { type: "json" };
import { commandRoot } from "../commands/root.ts";

const loggerLayer = Logger.layer([Logger.consolePretty()]);
const runtimeLayer = Layer.mergeAll(
  BunServices.layer,
  loggerLayer,
  Layer.succeed(Logger.LogToStderr, true),
);

export const runCli = (args: ReadonlyArray<string>) =>
  Command.runWith(commandRoot, {
    version: PackageJson.version,
  })(args).pipe(Effect.provide(runtimeLayer));

export const cliProgram = commandRoot.pipe(
  Command.run({
    version: PackageJson.version,
  }),
  Effect.provide(runtimeLayer),
);
