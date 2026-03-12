import { Effect, Option, ServiceMap } from "effect";
import {
  UltimateSearchConfig,
  type UltimateSearchConfigService,
} from "../config/settings.ts";
import type { UltimateSearchError } from "../shared/errors.ts";
import {
  GrokProviderClient,
  type GrokProviderClientService,
} from "../providers/grok/client.ts";
import { type FetchService as FetchServiceShape } from "../shared/fetch.ts";
import {
  buildGrokUserMessage,
  type GrokChatCompletionRequest,
  type GrokSearchInput,
  type GrokSearchResult,
  grokSystemPrompt,
} from "../providers/grok/schema.ts";

export interface GrokSearchService {
  readonly search: (
    input: GrokSearchInput,
  ) => Effect.Effect<
    GrokSearchResult,
    UltimateSearchError,
    UltimateSearchConfigService | GrokProviderClientService | FetchServiceShape
  >;
}

export const GrokSearch = ServiceMap.Service<GrokSearchService>("GrokSearch");

export const GrokSearchLive = GrokSearch.of({
  search: (input) =>
    Effect.gen(function* () {
      const config = yield* UltimateSearchConfig;
      const provider = yield* GrokProviderClient;
      const grok = yield* config.grok;

      const payload: GrokChatCompletionRequest = {
        model: Option.getOrElse(input.model, () => grok.model),
        stream: false,
        messages: [
          {
            role: "system",
            content: grokSystemPrompt,
          },
          {
            role: "user",
            content: buildGrokUserMessage(input),
          },
        ],
      };
      const response = yield* provider.createChatCompletion(payload);

      return {
        content: response.choices[0].message.content,
        model: response.model,
        usage: response.usage,
      } satisfies GrokSearchResult;
    }),
});
