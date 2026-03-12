import { it } from "@effect/vitest";
import {
  Cause,
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
import { CliOutput } from "../src/shared/output";

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
      CliError.isCliError(error)
        ? Effect.void
        : Effect.gen(function* () {
            const cliOutput = yield* CliOutput;
            yield* cliOutput.writeError(error);
          }),
    ),
  );

const unusedFetchLayer = Layer.succeed(
  FetchService,
  FetchService.of({
    fetch: () => Promise.reject(new Error("fetch is not used in this test")),
  }),
);

const runCli = (
  args: ReadonlyArray<string>,
  layer: Layer.Layer<any, any, any>,
  env?: {
    readonly AGENT?: string | undefined;
  },
) =>
  renderNonCliErrors(
    Command.runWith(commandRoot, {
      version: PackageJson.version,
    })(args),
  ).pipe(
    Effect.provide(
      Layer.merge(commandRuntimeLayer, Layer.merge(layer, CliOutput.layerForArgs(args, env))),
    ),
  );

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
    "returns an interrupt-only exit for mcp stdio when stdin closes immediately",
    Effect.fn(function* () {
      const harness = makeHarness();

      const layer = Layer.mergeAll(harness.layer, unusedFetchLayer);

      const exit = yield* Effect.promise(() =>
        Effect.runPromiseExit(
          Effect.exit(runCli(["mcp", "stdio"], layer) as Effect.Effect<void, unknown, never>),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
      }
      expect(harness.consoleStdout).toEqual([]);
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "runs grok search with mocked provider success and human-readable output by default",
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
      const output = harness.consoleStdout.join("\n");

      expect(output).toContain("Mocked Grok answer");
      expect(output).toContain("Model: grok-test");
      expect(output).toContain("Tokens: 46 total (12 prompt, 34 completion)");
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "switches grok success output to llm JSON when AGENT is set",
    Effect.fn(function* () {
      const harness = makeHarness();
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: () =>
            Promise.resolve(
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
            ),
        }),
      );

      const exit = yield* Effect.exit(
        runCli(
          ["search", "grok", "--query", "release notes"],
          Layer.mergeAll(harness.layer, fetchLayer),
          { AGENT: "codex" },
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

      expect(Exit.isSuccess(exit)).toBe(true);
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
    "allows --output human to override AGENT-driven llm mode",
    Effect.fn(function* () {
      const harness = makeHarness();
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: () =>
            Promise.resolve(
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
            ),
        }),
      );

      const exit = yield* Effect.exit(
        runCli(
          ["search", "grok", "--query", "release notes", "--output", "human"],
          Layer.mergeAll(harness.layer, fetchLayer),
          { AGENT: "codex" },
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

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(harness.consoleStdout.join("\n")).toContain("Model: grok-test");
      expect(harness.consoleStdout.join("\n")).not.toContain('"model": "grok-test"');
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "renders config validation errors for invalid grok urls in human-readable form by default",
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
      const errorOutput = harness.consoleStderr.join("\n");
      expect(errorOutput).toContain("Configuration error (shared)");
      expect(errorOutput).toContain("Failed to load CLI configuration.");
      expect(errorOutput).toContain("GROK_API_URL must be an absolute URL.");
    }),
  );

  it.effect(
    "renders provider errors for grok search failures in llm mode when requested",
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
          ["search", "grok", "--query", "release notes", "--output", "llm"],
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
    "renders config validation errors for missing grok settings in human-readable form by default",
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
      const errorOutput = harness.consoleStderr.join("\n");
      expect(errorOutput).toContain("Configuration error (grok)");
      expect(errorOutput).toContain("Missing required Grok configuration.");
      expect(errorOutput).toContain("Set GROK_API_URL to the grok base URL.");
      expect(errorOutput).toContain("Set GROK_API_KEY to the grok bearer token.");
    }),
  );

  it.effect(
    "runs fetch with Tavily-first JSON output and backend reporting",
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
                  results: [
                    {
                      url: "https://example.com/docs",
                      title: "Example Docs",
                      raw_content: "# Example\n\nTavily page content",
                    },
                  ],
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
            "fetch",
            "--url",
            " https://example.com/docs ",
            "--depth",
            "advanced",
            "--format",
            "markdown",
            "--output",
            "llm",
          ],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                TAVILY_API_URL: "https://tavily.example.com",
                TAVILY_API_KEY: "tavily-secret",
              },
            }),
          ),
        ),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(requests).toEqual(["https://tavily.example.com/extract"]);
      expect(requestBodies).toEqual([
        {
          urls: ["https://example.com/docs"],
          extract_depth: "advanced",
          format: "markdown",
        },
      ]);
      expect(
        decodeJson(
          Schema.Struct({
            backend: Schema.String,
            format: Schema.String,
            results: Schema.NonEmptyArray(
              Schema.Struct({
                url: Schema.String,
                title: Schema.NullOr(Schema.String),
                raw_content: Schema.String,
              }),
            ),
          }),
          harness.consoleStdout.join("\n"),
        ),
      ).toEqual({
        backend: "tavily",
        format: "markdown",
        results: [
          {
            url: "https://example.com/docs",
            title: "Example Docs",
            raw_content: "# Example\n\nTavily page content",
          },
        ],
      });
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "falls back to FireCrawl when Tavily returns no extractable content",
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

            if (String(input).includes("/extract")) {
              return Promise.resolve(
                new Response(
                  JSON.stringify({
                    results: [
                      {
                        url: "https://example.com/docs",
                        title: "Example Docs",
                        raw_content: null,
                      },
                    ],
                  }),
                  {
                    status: 200,
                    headers: {
                      "content-type": "application/json",
                    },
                  },
                ),
              );
            }

            return Promise.resolve(
              new Response(
                JSON.stringify({
                  success: true,
                  data: {
                    markdown: "FireCrawl page content",
                    metadata: {
                      title: "Fallback Title",
                    },
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
          ["fetch", "--url", "https://example.com/docs", "--output", "llm"],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                TAVILY_API_URL: "https://tavily.example.com",
                TAVILY_API_KEY: "tavily-secret",
                FIRECRAWL_API_KEY: "firecrawl-secret",
              },
            }),
          ),
        ),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(requests).toEqual([
        "https://tavily.example.com/extract",
        "https://api.firecrawl.dev/v2/scrape",
      ]);
      expect(requestBodies).toEqual([
        {
          urls: ["https://example.com/docs"],
          extract_depth: "basic",
          format: "markdown",
        },
        {
          url: "https://example.com/docs",
          formats: ["markdown"],
        },
      ]);
      expect(
        decodeJson(
          Schema.Struct({
            backend: Schema.String,
            format: Schema.String,
            results: Schema.NonEmptyArray(
              Schema.Struct({
                url: Schema.String,
                title: Schema.NullOr(Schema.String),
                raw_content: Schema.String,
              }),
            ),
            fallback: Schema.Struct({
              from: Schema.String,
              to: Schema.String,
              reason: Schema.Struct({
                type: Schema.String,
                provider: Schema.String,
                message: Schema.String,
              }),
            }),
          }),
          harness.consoleStdout.join("\n"),
        ),
      ).toEqual({
        backend: "firecrawl",
        format: "markdown",
        results: [
          {
            url: "https://example.com/docs",
            title: "Fallback Title",
            raw_content: "FireCrawl page content",
          },
        ],
        fallback: {
          from: "tavily",
          to: "firecrawl",
          reason: {
            type: "ProviderContentError",
            provider: "tavily",
            message: "Tavily returned no extractable content.",
          },
        },
      });
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "validates fetch urls before calling providers",
    Effect.fn(function* () {
      const harness = makeHarness();
      const calls: Array<string> = [];
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: (input) => {
            calls.push(String(input));
            return Promise.reject(new Error("fetch should not be called"));
          },
        }),
      );

      const exit = yield* Effect.exit(
        runCli(["fetch", "--url", "not-a-url"], Layer.mergeAll(harness.layer, fetchLayer)).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} })),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(calls).toEqual([]);
      expect(harness.consoleStdout.join("\n")).toContain("ultimate-search fetch [flags]");
      expect(harness.consoleStderr.join("\n")).toContain("url must be an absolute URL");
    }),
  );

  it.effect(
    "runs tavily search with mocked provider success and option handling",
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
                  query: "FastAPI releases",
                  answer: "Mocked Tavily answer",
                  response_time: 0.42,
                  results: [
                    {
                      title: "FastAPI release notes",
                      url: "https://fastapi.tiangolo.com/release-notes/",
                      content: "Latest FastAPI release notes",
                      score: 0.98,
                      raw_content: null,
                    },
                  ],
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
            "tavily",
            "--query",
            "  FastAPI releases  ",
            "--depth",
            "advanced",
            "--max-results",
            "3",
            "--topic",
            "news",
            "--time-range",
            "week",
            "--include-answer",
            "--output",
            "llm",
          ],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                TAVILY_API_URL: " https://tavily.example.com/ ",
                TAVILY_API_KEY: "tavily-secret",
              },
            }),
          ),
        ),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(requests).toEqual(["https://tavily.example.com/search"]);
      expect(requestBodies).toEqual([
        {
          query: "FastAPI releases",
          search_depth: "advanced",
          max_results: 3,
          topic: "news",
          time_range: "week",
          include_answer: true,
        },
      ]);
      expect(
        decodeJson(
          Schema.Struct({
            query: Schema.String,
            answer: Schema.NullOr(Schema.String),
            response_time: Schema.Number,
            results: Schema.Array(
              Schema.Struct({
                title: Schema.String,
                url: Schema.String,
                content: Schema.String,
                score: Schema.Number,
                raw_content: Schema.NullOr(Schema.String),
              }),
            ),
          }),
          harness.consoleStdout.join("\n"),
        ),
      ).toEqual({
        query: "FastAPI releases",
        answer: "Mocked Tavily answer",
        response_time: 0.42,
        results: [
          {
            title: "FastAPI release notes",
            url: "https://fastapi.tiangolo.com/release-notes/",
            content: "Latest FastAPI release notes",
            score: 0.98,
            raw_content: null,
          },
        ],
      });
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "preserves partial provider failure as top-level dual-search JSON",
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
            "dual",
            "--query",
            "  FastAPI releases  ",
            "--platform",
            "  GitHub  ",
            "--output",
            "llm",
          ],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                GROK_API_URL: " https://grok.example.com/ ",
                GROK_API_KEY: "secret-token",
              },
            }),
          ),
        ),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(requests).toEqual(["https://grok.example.com/v1/chat/completions"]);
      expect(requestBodies).toEqual([
        expect.objectContaining({
          model: "grok-4.1-fast",
          messages: [
            expect.objectContaining({
              role: "system",
            }),
            {
              role: "user",
              content: "FastAPI releases\n\nYou should focus on these platform: GitHub",
            },
          ],
        }),
      ]);
      expect(decodeJson<unknown>(Schema.Unknown, harness.consoleStdout.join("\n"))).toEqual({
        grok: {
          status: "success",
          result: {
            content: "Mocked Grok answer",
            model: "grok-test",
            usage: {
              prompt_tokens: 12,
              completion_tokens: 34,
              total_tokens: 46,
            },
          },
        },
        tavily: {
          status: "error",
          error: {
            type: "ConfigValidationError",
            provider: "tavily",
            message: "Missing required Tavily configuration.",
            details: [
              "Set TAVILY_API_URL to the Tavily or Tavily proxy base URL.",
              "Set TAVILY_API_KEY to the Tavily or Tavily proxy bearer token.",
            ],
          },
        },
      });
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "renders provider errors for tavily search failures",
    Effect.fn(function* () {
      const harness = makeHarness();
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: () =>
            Promise.resolve(
              new Response("tavily overloaded", {
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
          ["search", "tavily", "--query", "release notes", "--output", "llm"],
          Layer.mergeAll(harness.layer, fetchLayer),
          { AGENT: "codex" },
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                TAVILY_API_URL: "https://tavily.example.com",
                TAVILY_API_KEY: "tavily-secret",
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
          provider: "tavily",
          message: "Tavily returned HTTP 503.",
          status: 503,
          body: "tavily overloaded",
        },
      });
    }),
  );

  it.effect(
    "renders config validation errors for missing tavily settings",
    Effect.fn(function* () {
      const harness = makeHarness();

      const exit = yield* Effect.exit(
        runCli(
          ["search", "tavily", "--query", "release notes", "--output", "llm"],
          Layer.mergeAll(harness.layer, unusedFetchLayer),
          { AGENT: "codex" },
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
          provider: "tavily",
          message: "Missing required Tavily configuration.",
          details: [
            "Set TAVILY_API_URL to the Tavily or Tavily proxy base URL.",
            "Set TAVILY_API_KEY to the Tavily or Tavily proxy bearer token.",
          ],
        },
      });
    }),
  );

  it.effect(
    "runs tavily map with mocked provider success and emits llm JSON output",
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
                  base_url: "https://fastapi.tiangolo.com",
                  response_time: 0.18,
                  results: [
                    "https://fastapi.tiangolo.com/docs",
                    "https://fastapi.tiangolo.com/release-notes",
                  ],
                  usage: {
                    credits_used: 2,
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
            "map",
            "--url",
            " https://fastapi.tiangolo.com/ ",
            "--depth",
            "2",
            "--breadth",
            "20",
            "--limit",
            "50",
            "--instructions",
            "  Stay within docs pages  ",
            "--output",
            "llm",
          ],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                TAVILY_API_URL: " https://tavily.example.com/ ",
                TAVILY_API_KEY: "tavily-secret",
              },
            }),
          ),
        ),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(requests).toEqual(["https://tavily.example.com/map"]);
      expect(requestBodies).toEqual([
        {
          url: "https://fastapi.tiangolo.com",
          max_depth: 2,
          max_breadth: 20,
          limit: 50,
          instructions: "Stay within docs pages",
        },
      ]);
      expect(
        decodeJson(
          Schema.Struct({
            base_url: Schema.String,
            response_time: Schema.Number,
            results: Schema.Array(Schema.String),
            usage: Schema.Struct({
              credits_used: Schema.Number,
            }),
          }),
          harness.consoleStdout.join("\n"),
        ),
      ).toEqual({
        base_url: "https://fastapi.tiangolo.com",
        response_time: 0.18,
        results: [
          "https://fastapi.tiangolo.com/docs",
          "https://fastapi.tiangolo.com/release-notes",
        ],
        usage: {
          credits_used: 2,
        },
      });
      expect(harness.consoleStderr).toEqual([]);
    }),
  );

  it.effect(
    "validates tavily map numeric bounds before provider execution",
    Effect.fn(function* () {
      const harness = makeHarness();
      let fetchCalls = 0;
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: () => {
            fetchCalls += 1;
            return Promise.reject(new Error("fetch should not be called"));
          },
        }),
      );

      const exit = yield* Effect.exit(
        runCli(
          ["map", "--url", "https://fastapi.tiangolo.com", "--depth", "0", "--output", "llm"],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                TAVILY_API_URL: "https://tavily.example.com",
                TAVILY_API_KEY: "tavily-secret",
              },
            }),
          ),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(fetchCalls).toBe(0);
      expect(harness.consoleStdout.join("\n")).toContain("ultimate-search map [flags]");
      expect(harness.consoleStderr.join("\n")).toContain(
        "depth must be an integer between 1 and 5",
      );
    }),
  );

  it.effect(
    "renders provider errors for tavily map failures in llm mode",
    Effect.fn(function* () {
      const harness = makeHarness();
      const fetchLayer = Layer.succeed(
        FetchService,
        FetchService.of({
          fetch: () =>
            Promise.resolve(
              new Response("map unavailable", {
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
          ["map", "--url", "https://fastapi.tiangolo.com", "--output", "llm"],
          Layer.mergeAll(harness.layer, fetchLayer),
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                TAVILY_API_URL: "https://tavily.example.com",
                TAVILY_API_KEY: "tavily-secret",
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
          provider: "tavily",
          message: "Tavily map returned HTTP 503.",
          status: 503,
          body: "map unavailable",
        },
      });
    }),
  );
});
