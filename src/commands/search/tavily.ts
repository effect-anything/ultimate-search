import { Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { UltimateSearchConfig } from "../../config/settings";
import {
  TavilySearchDepthSchema,
  TavilySearchInput,
  type TavilySearchResponse,
  TavilySearchTopicSchema,
  TavilyTimeRangeSchema,
} from "../../providers/tavily/schema";
import { TavilyProviderClient } from "../../providers/tavily/client";
import { TavilySearch } from "../../services/tavily-search";
import { optionalChoiceFlag, optionalIntegerFlag } from "../../shared/cli-flags";
import { runCommandWithOutput } from "../../shared/command-output";
import { outputFlag } from "../../shared/output";
import { trimmedNonEmptyStringSchema } from "../../shared/schema";

const tavilyCommandLayer = TavilySearch.layer.pipe(
  Layer.provideMerge(TavilyProviderClient.layer),
  Layer.provideMerge(UltimateSearchConfig.layer),
);

const renderHumanTavilyResult = (result: TavilySearchResponse) => {
  const lines: Array<string> = [];

  if (result.answer != null && result.answer.trim().length > 0) {
    lines.push(result.answer.trim(), "");
  }

  if (result.response_time != null) {
    lines.push(`Response time: ${result.response_time}s`, "");
  }

  for (const [index, item] of result.results.entries()) {
    lines.push(`${index + 1}. ${item.title}`);
    lines.push(item.url);
    lines.push(item.content.trim());

    if (index < result.results.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n").trim();
};

export const commandSearchTavily = Command.make(
  "tavily",
  {
    query: Flag.string("query").pipe(
      Flag.withSchema(trimmedNonEmptyStringSchema("query must be a non-empty string")),
      Flag.withDescription("Search query to send to Tavily."),
    ),
    searchDepth: optionalChoiceFlag(
      "depth",
      TavilySearchDepthSchema.literals,
      "Optional Tavily search depth.",
    ),
    maxResults: optionalIntegerFlag(
      "max-results",
      "Optional number of Tavily results to return.",
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
    yield* runCommandWithOutput(input.output, (mode) =>
      Effect.gen(function* () {
        const request = yield* TavilySearchInput.decodeEffect(input);
        const tavilySearch = yield* TavilySearch;
        const result = yield* tavilySearch.search(request);

        return {
          human: mode === "human" ? renderHumanTavilyResult(result) : "",
          llm: result,
        };
      }),
    );
  }),
).pipe(
  Command.withDescription("Run Tavily-backed search."),
  Command.withExamples([
    {
      command:
        'ultimate-search search tavily --query "FastAPI latest features" --depth advanced --max-results 5',
      description: "Run a Tavily-backed web search with optional search tuning.",
    },
  ]),
  Command.provide(tavilyCommandLayer),
);
