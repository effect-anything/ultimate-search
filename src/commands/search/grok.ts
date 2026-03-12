import { Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { UltimateSearchConfig } from "../../config/settings";
import { GrokProviderClient } from "../../providers/grok/client";
import { GrokSearchInput, type GrokSearchResult } from "../../providers/grok/schema";
import { GrokSearch } from "../../services/grok-search";
import { optionalTrimmedTextFlag } from "../../shared/cli-flags";
import { runCommandWithOutput } from "../../shared/command-output";
import { outputFlag } from "../../shared/output";
import { trimmedNonEmptyStringSchema } from "../../shared/schema";

const grokCommandLayer = GrokSearch.layer.pipe(
  Layer.provideMerge(GrokProviderClient.layer),
  Layer.provideMerge(UltimateSearchConfig.layer),
);

const renderHumanGrokResult = (result: GrokSearchResult) =>
  [
    result.content.trim().length > 0 ? result.content.trim() : "Grok returned an empty response.",
    "",
    `Model: ${result.model}`,
    `Tokens: ${result.usage.total_tokens} total (${result.usage.prompt_tokens} prompt, ${result.usage.completion_tokens} completion)`,
  ].join("\n");

export const commandSearchGrok = Command.make(
  "grok",
  {
    query: Flag.string("query").pipe(
      Flag.withSchema(trimmedNonEmptyStringSchema("query must be a non-empty string")),
      Flag.withDescription("Search query to send to Grok."),
    ),
    platform: optionalTrimmedTextFlag(
      "platform",
      "Optional platform focus such as GitHub or Reddit.",
    ),
    model: optionalTrimmedTextFlag("model", "Override the configured Grok model."),
    output: outputFlag,
  },
  Effect.fn(function* (input) {
    yield* runCommandWithOutput(input.output, () =>
      Effect.gen(function* () {
        const request = yield* GrokSearchInput.decodeEffect({
          query: input.query,
          platform: input.platform,
          model: input.model,
        });
        const grokSearch = yield* GrokSearch;
        const result = yield* grokSearch.search(request);

        return {
          human: renderHumanGrokResult(result),
          llm: result,
        };
      }),
    );
  }),
).pipe(
  Command.withDescription("Run Grok-backed search."),
  Command.withExamples([
    {
      command: 'ultimate-search search grok --query "FastAPI latest features"',
      description: "Run a Grok-backed web search with the configured model.",
    },
    {
      command: 'ultimate-search search grok --query "FastAPI latest features" --output llm',
      description: "Emit structured JSON for agent-driven workflows.",
    },
  ]),
  Command.provide(grokCommandLayer),
);
