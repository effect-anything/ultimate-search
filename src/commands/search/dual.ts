import { Effect, Layer, Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { UltimateSearchConfig } from "../../config/settings";
import { GrokProviderClient } from "../../providers/grok/client";
import {
  TavilySearchDepthSchema,
  TavilySearchTopicSchema,
  TavilyTimeRangeSchema,
} from "../../providers/tavily/schema";
import { TavilyProviderClient } from "../../providers/tavily/client";
import { DualSearch, DualSearchInput } from "../../services/dual-search";
import { GrokSearch } from "../../services/grok-search";
import { TavilySearch } from "../../services/tavily-search";
import { CliOutput, outputFlag, renderJsonText } from "../../shared/output";
import { trimmedNonEmptyStringSchema } from "../../shared/schema";

const dualCommandLayer = DualSearch.layer.pipe(
  Layer.provideMerge(GrokSearch.layer),
  Layer.provideMerge(TavilySearch.layer),
  Layer.provideMerge(GrokProviderClient.layer),
  Layer.provideMerge(TavilyProviderClient.layer),
  Layer.provideMerge(UltimateSearchConfig.layer),
);

const optionalTrimmedTextFlag = (name: string, description: string) =>
  Flag.optional(
    Flag.string(name).pipe(Flag.withSchema(Schema.Trim), Flag.withDescription(description)),
  ).pipe(Flag.map((value) => Option.filter(value, (text) => text.length > 0)));

const optionalChoiceFlag = <A extends string>(
  name: string,
  choices: ReadonlyArray<A>,
  description: string,
) =>
  Flag.optional(Flag.choice(name, choices)).pipe(
    Flag.map((value) => Option.filter(value, () => true)),
    Flag.withDescription(description),
  );

export const commandSearchDual = Command.make(
  "dual",
  {
    query: Flag.string("query").pipe(
      Flag.withSchema(trimmedNonEmptyStringSchema("query must be a non-empty string")),
      Flag.withDescription("Search query to send to both Grok and Tavily."),
    ),
    platform: optionalTrimmedTextFlag(
      "platform",
      "Optional platform focus for the Grok branch such as GitHub or Reddit.",
    ),
    model: optionalTrimmedTextFlag("model", "Override the configured Grok model."),
    searchDepth: optionalChoiceFlag(
      "depth",
      TavilySearchDepthSchema.literals,
      "Optional Tavily search depth.",
    ),
    maxResults: Flag.optional(
      Flag.integer("max-results").pipe(
        Flag.withDescription("Optional number of Tavily results to return."),
      ),
    ),
    topic: optionalChoiceFlag(
      "topic",
      TavilySearchTopicSchema.literals,
      "Optional Tavily topic focus.",
    ),
    timeRange: optionalChoiceFlag(
      "time-range",
      TavilyTimeRangeSchema.literals,
      "Optional Tavily recency window.",
    ),
    includeAnswer: Flag.boolean("include-answer").pipe(
      Flag.withDescription("Request a synthesized Tavily answer in the response."),
    ),
    output: outputFlag,
  },
  Effect.fn(function* (input) {
    const request = yield* DualSearchInput.decodeEffect(input);
    const dualSearch = yield* DualSearch;
    const cliOutput = yield* CliOutput;
    const result = yield* dualSearch.search(request);

    yield* cliOutput.writeOutput({
      human: renderJsonText(result),
      llm: result,
    });
  }),
).pipe(
  Command.withDescription("Run Grok and Tavily search concurrently."),
  Command.withExamples([
    {
      command:
        'ultimate-search search dual --query "FastAPI latest features" --depth advanced --include-answer',
      description: "Run both providers and merge their status-tagged results into one JSON object.",
    },
  ]),
  Command.provide(dualCommandLayer),
);
