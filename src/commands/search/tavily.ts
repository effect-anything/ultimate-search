import { Effect, Layer, Option } from "effect";
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
import { CliOutput, outputFlag } from "../../shared/output";
import { trimmedNonEmptyStringSchema } from "../../shared/schema";

const tavilyCommandLayer = TavilySearch.layer.pipe(
  Layer.provideMerge(TavilyProviderClient.layer),
  Layer.provideMerge(UltimateSearchConfig.layer),
);

const optionalChoiceFlag = <A extends string>(
  name: string,
  choices: ReadonlyArray<A>,
  description: string,
) =>
  Flag.optional(Flag.choice(name, choices)).pipe(
    Flag.map((value) => Option.filter(value, () => true)),
    Flag.withDescription(description),
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
    const request = yield* TavilySearchInput.decodeEffect(input);
    const tavilySearch = yield* TavilySearch;
    const cliOutput = yield* CliOutput;
    const result = yield* tavilySearch.search(request);

    yield* cliOutput.writeOutput({
      human: cliOutput.mode === "human" ? renderHumanTavilyResult(result) : "",
      llm: result,
    });
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
