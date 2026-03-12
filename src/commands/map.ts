import { Effect, Layer, Option, Schema } from "effect";
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
import { CliOutput, outputFlag } from "../shared/output";
import { absoluteUrlStringSchema } from "../shared/schema";

const mapCommandLayer = TavilyMap.layer.pipe(
  Layer.provideMerge(TavilyProviderClient.layer),
  Layer.provideMerge(UltimateSearchConfig.layer),
);

const optionalTrimmedTextFlag = (name: string, description: string) =>
  Flag.optional(
    Flag.string(name).pipe(Flag.withSchema(Schema.Trim), Flag.withDescription(description)),
  ).pipe(Flag.map((value) => Option.filter(value, (text) => text.length > 0)));

const renderHumanMapResult = (result: TavilyMapResponse) => {
  const lines = [
    `Base URL: ${result.base_url}`,
    `Discovered URLs: ${result.results.length}`,
  ];

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
    depth: Flag.optional(
      Flag.integer("depth").pipe(
        Flag.withSchema(TavilyMapDepthSchema),
        Flag.withDescription("Optional crawl depth between 1 and 5."),
      ),
    ),
    breadth: Flag.optional(
      Flag.integer("breadth").pipe(
        Flag.withSchema(TavilyMapBreadthSchema),
        Flag.withDescription("Optional crawl breadth between 1 and 500."),
      ),
    ),
    limit: Flag.optional(
      Flag.integer("limit").pipe(
        Flag.withSchema(TavilyMapLimitSchema),
        Flag.withDescription("Optional maximum number of discovered URLs to return."),
      ),
    ),
    instructions: optionalTrimmedTextFlag(
      "instructions",
      "Optional guidance for how Tavily should explore the site.",
    ),
    output: outputFlag,
  },
  Effect.fn(function* (input) {
    const request = yield* TavilyMapInput.decodeEffect(input);
    const tavilyMap = yield* TavilyMap;
    const cliOutput = yield* CliOutput;
    const result = yield* tavilyMap.map(request);

    yield* cliOutput.writeOutput({
      human: renderHumanMapResult(result),
      llm: result,
    });
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
