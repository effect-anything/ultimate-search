import { it } from "@effect/vitest";
import { Console, Effect, FileSystem, Layer, Path, Sink, Stdio, Terminal } from "effect";
import { Command } from "effect/unstable/cli";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { expect } from "vitest";
import PackageJson from "../package.json" with { type: "json" };
import { commandRoot } from "../src/commands/root.ts";

const textDecoder = new TextDecoder();

const formatArgs = (args: ReadonlyArray<unknown>) => args.map(String).join(" ");

const makeTestConsole = (stdout: Array<string>, stderr: Array<string>): Console.Console => ({
  assert: () => {},
  clear: () => {},
  count: () => {},
  countReset: () => {},
  debug: (...args) => {
    stderr.push(formatArgs(args));
  },
  dir: (...args) => {
    stdout.push(formatArgs(args));
  },
  dirxml: (...args) => {
    stdout.push(formatArgs(args));
  },
  error: (...args) => {
    stderr.push(formatArgs(args));
  },
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  info: (...args) => {
    stdout.push(formatArgs(args));
  },
  log: (...args) => {
    stdout.push(formatArgs(args));
  },
  table: (...args) => {
    stdout.push(formatArgs(args));
  },
  time: () => {},
  timeEnd: () => {},
  timeLog: (...args) => {
    stdout.push(formatArgs(args));
  },
  trace: (...args) => {
    stderr.push(formatArgs(args));
  },
  warn: (...args) => {
    stderr.push(formatArgs(args));
  },
});

const captureChunk = (buffer: Array<string>) =>
  Sink.forEach((chunk: string | Uint8Array) =>
    Effect.sync(() => {
      buffer.push(
        typeof chunk === "string" ? chunk : textDecoder.decode(chunk),
      );
    }));

const makeHarness = () => {
  const consoleStdout: Array<string> = [];
  const consoleStderr: Array<string> = [];
  const stdioStdout: Array<string> = [];
  const stdioStderr: Array<string> = [];

  const layer = Layer.mergeAll(
    Stdio.layerTest({
      stdout: () => captureChunk(stdioStdout),
      stderr: () => captureChunk(stdioStderr),
    }),
    Layer.succeed(Console.Console, makeTestConsole(consoleStdout, consoleStderr)),
  );

  return {
    consoleStdout,
    consoleStderr,
    stdioStdout,
    stdioStderr,
    layer,
  };
};

const commandRuntimeLayer = Layer.mergeAll(
  Path.layer,
  FileSystem.layerNoop({}),
  Layer.succeed(
    Terminal.Terminal,
    {
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      isTTY: Effect.succeed(false),
      readInput: Effect.die("Terminal.readInput is not available in tests"),
      readLine: Effect.die("Terminal.readLine is not available in tests"),
      display: () => Effect.void,
    } as unknown as Terminal.Terminal,
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() =>
      Effect.die("ChildProcessSpawner.spawn is not available in tests"),
    ),
  ),
);

const runCli = (args: ReadonlyArray<string>) =>
  Command.runWith(commandRoot, {
    version: PackageJson.version,
  })(args).pipe(Effect.provide(commandRuntimeLayer));

it.layer(Layer.empty)((it) => {
  it.effect("renders root help with the top-level command tree", () =>
    Effect.gen(function* () {
      const harness = makeHarness();

      yield* runCli(["--help"]).pipe(Effect.provide(harness.layer));

      const output = harness.consoleStdout.join("\n");

      expect(output).toContain("ultimate-search");
      expect(output).toContain("search");
      expect(output).toContain("fetch");
      expect(output).toContain("map");
      expect(output).toContain("mcp");
    }));

  it.effect("renders nested search help with provider stubs", () =>
    Effect.gen(function* () {
      const harness = makeHarness();

      yield* runCli(["search", "--help"]).pipe(Effect.provide(harness.layer));

      const output = harness.consoleStdout.join("\n");

      expect(output).toContain("grok");
      expect(output).toContain("tavily");
      expect(output).toContain("dual");
    }));

  it.effect("writes stub notices to stderr for provider commands", () =>
    Effect.gen(function* () {
      const harness = makeHarness();

      yield* runCli(["search", "grok"]).pipe(Effect.provide(harness.layer));
      yield* runCli(["mcp", "stdio"]).pipe(Effect.provide(harness.layer));

      expect(harness.stdioStdout).toEqual([]);
      expect(harness.consoleStderr).toEqual([]);
      expect(harness.stdioStderr.join("")).toContain(
        "The 'ultimate-search search grok' command is not implemented yet.\n",
      );
      expect(harness.stdioStderr.join("")).toContain(
        "The 'ultimate-search mcp stdio' command is not implemented yet.\n",
      );
    }));
});
