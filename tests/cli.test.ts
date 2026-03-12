import { it } from "@effect/vitest";
import {
  ConfigProvider,
  Console,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Path,
  Schema,
  Sink,
  Stdio,
  Terminal,
} from "effect";
import { Command } from "effect/unstable/cli";
import * as CliError from "effect/unstable/cli/CliError";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import { expect } from "vitest";
import PackageJson from "../package.json" with { type: "json" };
import { commandRoot } from "../src/commands/root";
import { FetchService } from "../src/shared/fetch";
import { writeRenderedError } from "../src/shared/output";

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
      buffer.push(typeof chunk === "string" ? chunk : textDecoder.decode(chunk));
    }),
  );

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
  Layer.succeed(Terminal.Terminal, {
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    isTTY: Effect.succeed(false),
    readInput: Effect.die("Terminal.readInput is not available in tests"),
    readLine: Effect.die("Terminal.readLine is not available in tests"),
    display: () => Effect.void,
  } as unknown as Terminal.Terminal),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() =>
      Effect.die("ChildProcessSpawner.spawn is not available in tests"),
    ),
  ),
);

const renderNonCliErrors = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.tapError((error) =>
      CliError.isCliError(error) ? Effect.void : writeRenderedError(error),
    ),
  );

const unusedFetchLayer = Layer.succeed(
  FetchService,
  FetchService.of({
    fetch: () => Promise.reject(new Error("fetch is not used in this test")),
  }),
);

const runCli = (args: ReadonlyArray<string>, layer: Layer.Layer<any, any, any>) =>
  renderNonCliErrors(
    Command.runWith(commandRoot, {
      version: PackageJson.version,
    })(args),
  ).pipe(Effect.provide(Layer.merge(commandRuntimeLayer, layer)));

const decodeJson = <A>(_schema: Schema.Top, text: string) =>
  Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(text) as A;

it.layer(Layer.empty)((it) => {
  it.effect(
    "renders root help with the top-level command tree",
    Effect.fn(function* () {
      const harness = makeHarness();

      yield* runCli(["--help"], Layer.mergeAll(harness.layer, unusedFetchLayer));

      const output = harness.consoleStdout.join("\n");

      expect(output).toContain("ultimate-search");
      expect(output).toContain("search");
      expect(output).toContain("fetch");
      expect(output).toContain("map");
      expect(output).toContain("mcp");
    }),
  );

  it.effect(
    "renders nested search help with provider stubs",
    Effect.fn(function* () {
      const harness = makeHarness();

      yield* runCli(["search", "--help"], Layer.mergeAll(harness.layer, unusedFetchLayer));

      const output = harness.consoleStdout.join("\n");

      expect(output).toContain("grok");
      expect(output).toContain("tavily");
      expect(output).toContain("dual");
    }),
  );

  it.effect(
    "writes stub notices to stderr for provider commands",
    Effect.fn(function* () {
      const harness = makeHarness();

      const layer = Layer.mergeAll(harness.layer, unusedFetchLayer);

      yield* runCli(["mcp", "stdio"], layer);

      expect(harness.consoleStdout).toEqual([]);
      expect(harness.consoleStderr.join("")).toContain(
        "The 'ultimate-search mcp stdio' command is not implemented yet.",
      );
    }),
  );

  it.effect(
    "runs grok search with mocked provider success",
    Effect.fn(function* () {
      const harness = makeHarness();
      const requests: Array<string> = [];
      const requestBodies: Array<unknown> = [];
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: (input, init) => {
            requests.push(String(input));
            requestBodies.push(JSON.parse(String(init?.body ?? "{}")));

            return Promise.resolve(
              new Response(
                JSON.stringify({
                  model: "grok-test",
                  choices: [
                    {
                      message: {
                        role: "assistant",
                        content: "Mocked Grok answer",
                      },
                    },
                  ],
                  usage: {
                    prompt_tokens: 12,
                    completion_tokens: 34,
                    total_tokens: 46,
                  },
                }),
                {
                  status: 200,
                  headers: {
                    "content-type": "application/json",
                  },
                },
              ),
            );
          },
        }),
      );

      const exit = yield* Effect.exit(
        runCli(
          [
            "search",
            "grok",
            "--query",
            "  FastAPI routers  ",
            "--platform",
            "  GitHub  ",
            "--model",
            "  grok-cli-override  ",
          ],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                GROK_API_URL: " https://grok.example.com/ ",
                GROK_API_KEY: "secret-token",
                GROK_MODEL: "grok-test",
              },
            }),
          ),
        ),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(requests).toEqual(["https://grok.example.com/v1/chat/completions"]);
      expect(requestBodies).toEqual([
        expect.objectContaining({
          model: "grok-cli-override",
          messages: [
            expect.objectContaining({
              role: "system",
            }),
            {
              role: "user",
              content: "FastAPI routers\n\nYou should focus on these platform: GitHub",
            },
          ],
        }),
      ]);
      expect(
        decodeJson(
          Schema.Struct({
            content: Schema.String,
            model: Schema.String,
            usage: Schema.Struct({
              prompt_tokens: Schema.Number,
              completion_tokens: Schema.Number,
              total_tokens: Schema.Number,
            }),
          }),
          harness.consoleStdout.join("\n"),
        ),
      ).toEqual({
        content: "Mocked Grok answer",
        model: "grok-test",
        usage: {
          prompt_tokens: 12,
          completion_tokens: 34,
          total_tokens: 46,
        },
      });
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "renders config validation errors for invalid grok urls",
    Effect.fn(function* () {
      const harness = makeHarness();

      const exit = yield* Effect.exit(
        runCli(
          ["search", "grok", "--query", "release notes"],
          Layer.mergeAll(harness.layer, unusedFetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                GROK_API_URL: "not-a-url",
                GROK_API_KEY: "secret-token",
              },
            }),
          ),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(harness.consoleStdout).toEqual([]);
      expect(
        decodeJson(
          Schema.Struct({
            error: Schema.Struct({
              type: Schema.String,
              provider: Schema.String,
              message: Schema.String,
              details: Schema.Array(Schema.String),
            }),
          }),
          harness.consoleStderr.join("\n"),
        ),
      ).toEqual({
        error: {
          type: "ConfigValidationError",
          provider: "shared",
          message: "Failed to load CLI configuration.",
          details: [expect.stringContaining("GROK_API_URL must be an absolute URL.")],
        },
      });
    }),
  );

  it.effect(
    "renders provider errors for grok search failures",
    Effect.fn(function* () {
      const harness = makeHarness();
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: () =>
            Promise.resolve(
              new Response("provider unavailable", {
                status: 503,
                headers: {
                  "content-type": "text/plain",
                },
              }),
            ),
        }),
      );

      const exit = yield* Effect.exit(
        runCli(
          ["search", "grok", "--query", "release notes"],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                GROK_API_URL: "https://grok.example.com",
                GROK_API_KEY: "secret-token",
              },
            }),
          ),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(harness.consoleStdout).toEqual([]);
      expect(
        decodeJson(
          Schema.Struct({
            error: Schema.Struct({
              type: Schema.String,
              provider: Schema.String,
              message: Schema.String,
              status: Schema.Number,
              body: Schema.String,
            }),
          }),
          harness.consoleStderr.join("\n"),
        ),
      ).toEqual({
        error: {
          type: "ProviderResponseError",
          provider: "grok",
          message: "Grok returned HTTP 503.",
          status: 503,
          body: "provider unavailable",
        },
      });
    }),
  );

  it.effect(
    "renders config validation errors for missing grok settings",
    Effect.fn(function* () {
      const harness = makeHarness();

      const exit = yield* Effect.exit(
        runCli(
          ["search", "grok", "--query", "release notes"],
          Layer.mergeAll(harness.layer, unusedFetchLayer),
        ).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} })),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(harness.consoleStdout).toEqual([]);
      expect(
        decodeJson(
          Schema.Struct({
            error: Schema.Struct({
              type: Schema.String,
              provider: Schema.String,
              message: Schema.String,
              details: Schema.Array(Schema.String),
            }),
          }),
          harness.consoleStderr.join("\n"),
        ),
      ).toEqual({
        error: {
          type: "ConfigValidationError",
          provider: "grok",
          message: "Missing required Grok configuration.",
          details: [
            "Set GROK_API_URL to the grok2api base URL.",
            "Set GROK_API_KEY to the grok2api bearer token.",
          ],
        },
      });
    }),
  );
});
