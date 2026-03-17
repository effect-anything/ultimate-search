import { Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { UltimateSearchConfig } from "../config/settings";
import {
  TavilyMapBreadthSchema,
  TavilyMapDepthSchema,
  TavilyMapInput,
  TavilyMapLimitSchema,
  type TavilyMapResponse,
} from "../providers/tavily/schema";
import { TavilyProviderClient } from "../providers/tavily/client";
import { TavilyMap } from "../services/tavily-map";
import { optionalIntegerFlagWithSchema, optionalTrimmedTextFlag } from "../shared/cli-flags";
import { runCommandWithOutput } from "../shared/command-output";
import { outputFlag } from "../shared/output";
import { absoluteUrlStringSchema } from "../shared/schema";

const mapCommandLayer = TavilyMap.layer.pipe(
  Layer.provideMerge(TavilyProviderClient.layer),
  Layer.provideMerge(UltimateSearchConfig.layer),
);

const renderHumanMapResult = (result: TavilyMapResponse) => {
  const lines = [`Base URL: ${result.base_url}`, `Discovered URLs: ${result.results.length}`];

  if (result.response_time !== undefined) {
    lines.push(`Response time: ${result.response_time}s`);
  }

  if (result.usage?.credits_used !== undefined) {
    lines.push(`Credits used: ${result.usage.credits_used}`);
  }

  if (result.results.length > 0) {
    lines.push("", ...result.results.map((url) => `- ${url}`));
  }

  return lines.join("\n");
};

export const commandMap = Command.make(
  "map",
  {
    url: Flag.string("url").pipe(
      Flag.withSchema(absoluteUrlStringSchema("url must be an absolute URL")),
      Flag.withDescription("Root URL to map with Tavily."),
    ),
    depth: optionalIntegerFlagWithSchema(
      "depth",
      TavilyMapDepthSchema,
      "Optional crawl depth between 1 and 5.",
    ),
    breadth: optionalIntegerFlagWithSchema(
      "breadth",
      TavilyMapBreadthSchema,
      "Optional crawl breadth between 1 and 500.",
    ),
    limit: optionalIntegerFlagWithSchema(
      "limit",
      TavilyMapLimitSchema,
      "Optional maximum number of discovered URLs to return.",
    ),
    instructions: optionalTrimmedTextFlag(
      "instructions",
      "Optional guidance for how Tavily should explore the site.",
    ),
    output: outputFlag,
  },
  Effect.fn(function* (input) {
    yield* runCommandWithOutput(input.output, () =>
      Effect.gen(function* () {
        const request = yield* TavilyMapInput.decodeEffect(input);
        const tavilyMap = yield* TavilyMap;
        const result = yield* tavilyMap.map(request);

        return {
          human: renderHumanMapResult(result),
          llm: result,
        };
      }),
    );
  }),
).pipe(
  Command.withDescription("Map a site's reachable URLs with Tavily."),
  Command.withExamples([
    {
      command:
        'ultimate-search map --url "https://fastapi.tiangolo.com" --depth 2 --breadth 20 --limit 50',
      description: "Discover reachable URLs for a site with Tavily map.",
    },
    {
      command: 'ultimate-search map --url "https://fastapi.tiangolo.com" --output llm',
      description: "Emit structured JSON for agent-driven workflows.",
    },
  ]),
  Command.provide(mapCommandLayer),
);
