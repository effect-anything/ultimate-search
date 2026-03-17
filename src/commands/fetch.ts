import { Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { UltimateSearchConfig } from "../config/settings";
import { FirecrawlProviderClient } from "../providers/firecrawl/client";
import { FetchContentFormatSchema, TavilyExtractDepthSchema } from "../providers/tavily/schema";
import { TavilyProviderClient } from "../providers/tavily/client";
import { FirecrawlFetch } from "../services/firecrawl-fetch";
import { TavilyExtract } from "../services/tavily-extract";
import { WebFetch } from "../services/web-fetch";
import { WebFetchInput, type WebFetchResult } from "../services/web-fetch-schema";
import { runCommandWithOutput } from "../shared/command-output";
import { outputFlag } from "../shared/output";
import { absoluteUrlStringSchema } from "../shared/schema";

const fetchCommandLayer = WebFetch.layer.pipe(
  Layer.provideMerge(FirecrawlFetch.layer),
  Layer.provideMerge(TavilyExtract.layer),
  Layer.provideMerge(FirecrawlProviderClient.layer),
  Layer.provideMerge(TavilyProviderClient.layer),
  Layer.provideMerge(UltimateSearchConfig.layer),
);

const renderHumanFetchResult = (result: WebFetchResult) => {
  const lines = [`Backend: ${result.backend}`];

  if (result.fallback != null) {
    lines.push(
      `Fallback: ${result.fallback.from} -> ${result.fallback.to} (${result.fallback.reason.message})`,
    );
  }

  for (const [index, page] of result.results.entries()) {
    lines.push("");
    lines.push(`URL: ${page.url}`);

    if (page.title != null && page.title.trim().length > 0) {
      lines.push(`Title: ${page.title.trim()}`);
    }

    lines.push("");
    lines.push(page.raw_content);

    if (index < result.results.length - 1) {
      lines.push("", "---");
    }
  }

  return lines.join("\n");
};

export const commandFetch = Command.make(
  "fetch",
  {
    url: Flag.string("url").pipe(
      Flag.withSchema(absoluteUrlStringSchema("url must be an absolute URL")),
      Flag.withDescription("Target page URL."),
    ),
    depth: Flag.choice("depth", TavilyExtractDepthSchema.literals).pipe(
      Flag.withDefault("basic"),
      Flag.withDescription("Optional Tavily extract depth."),
    ),
    format: Flag.choice("format", FetchContentFormatSchema.literals).pipe(
      Flag.withDefault("markdown"),
      Flag.withDescription("Normalized content format to return."),
    ),
    output: outputFlag,
  },
  Effect.fn(function* (input) {
    yield* runCommandWithOutput(input.output, (mode) =>
      Effect.gen(function* () {
        const request = yield* WebFetchInput.decodeEffect({
          urls: [input.url],
          depth: input.depth,
          format: input.format,
        });
        const webFetch = yield* WebFetch;
        const result = yield* webFetch.fetch(request);

        return {
          human: mode === "human" ? renderHumanFetchResult(result) : "",
          llm: result,
        };
      }),
    );
  }),
).pipe(
  Command.withDescription("Fetch and normalize page content from a URL."),
  Command.withExamples([
    {
      command: 'ultimate-search fetch --url "https://example.com"',
      description: "Fetch a page with Tavily first and FireCrawl as fallback.",
    },
  ]),
  Command.provide(fetchCommandLayer),
);
