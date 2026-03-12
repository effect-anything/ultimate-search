import { Effect, Layer } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import {
  UltimateSearchConfig,
  UltimateSearchConfigLive,
} from "../../config/settings.ts";
import { ConfigValidationError } from "../../shared/errors.ts";
import { writeJsonStdout } from "../../shared/output.ts";
import {
  GrokProviderClient,
  GrokProviderClientLive,
} from "../../providers/grok/client.ts";
import { normalizeGrokSearchInput } from "../../providers/grok/schema.ts";
import { GrokSearch, GrokSearchLive } from "../../services/grok-search.ts";

const grokCommandLayer = Layer.mergeAll(
  Layer.effect(UltimateSearchConfig, UltimateSearchConfigLive),
  Layer.succeed(GrokProviderClient, GrokProviderClientLive),
  Layer.succeed(GrokSearch, GrokSearchLive),
);

export const commandSearchGrok = Command.make(
  "grok",
  {
    query: Flag.string("query").pipe(
      Flag.withDescription("Search query to send to Grok."),
    ),
    platform: Flag.optional(Flag.string("platform")).pipe(
      Flag.withDescription("Optional platform focus such as GitHub or Reddit."),
    ),
    model: Flag.optional(Flag.string("model")).pipe(
      Flag.withDescription("Override the configured Grok model."),
    ),
  },
  (input) =>
    Effect.gen(function* () {
      const request = normalizeGrokSearchInput(
        input.query,
        input.platform,
        input.model,
      );

      if (request.query.length === 0) {
        return yield* new ConfigValidationError({
          provider: "grok",
          message: "Invalid CLI input.",
          details: ["--query must be a non-empty string."],
        });
      }

      const grokSearch = yield* GrokSearch;
      const result = yield* grokSearch.search(request);

      yield* writeJsonStdout(result);
    }),
).pipe(
  Command.withDescription("Run Grok-backed search."),
  Command.withExamples([
    {
      command: "ultimate-search search grok --query \"FastAPI latest features\"",
      description: "Run a Grok-backed web search with the configured model.",
    },
  ]),
  Command.provide(grokCommandLayer),
);
