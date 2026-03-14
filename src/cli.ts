#!/usr/bin/env node
import { NodeHttpClient, NodeRuntime, NodeServices } from "@effect/platform-node";
import { ConfigProvider, Effect, Layer, Logger } from "effect";
import { Command } from "effect/unstable/cli";
import PackageJson from "../package.json" with { type: "json" };
import { commandRoot } from "./commands/root";
import { CliOutput, cliLoggerLayer } from "./shared/output";
import { TracingLayer } from "./shared/tracing";

const Live = Layer.mergeAll(
  NodeServices.layer,
  NodeHttpClient.layerFetch,
  cliLoggerLayer,
  CliOutput.layer,
  Layer.succeed(Logger.LogToStderr, true),
).pipe(Layer.provide([TracingLayer, ConfigProvider.layer(ConfigProvider.fromEnv())]));

NodeRuntime.runMain(
  Command.run(commandRoot, { version: PackageJson.version }).pipe(Effect.provide(Live)),
  { disableErrorReporting: true },
);
