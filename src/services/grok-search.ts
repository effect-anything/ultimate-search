import { Effect, Layer, Option, ServiceMap } from "effect";
import { UltimateSearchConfig } from "../config/settings";
import { GrokProviderClient } from "../providers/grok/client";
import {
  buildGrokUserMessage,
  type GrokChatCompletionRequest,
  GrokSearchInput,
  type GrokSearchResult,
  grokSystemPrompt,
} from "../providers/grok/schema";
import type { UltimateSearchError } from "../shared/errors";
import type { ServicesReturns } from "../shared/effect";

export class GrokSearch extends ServiceMap.Service<
  GrokSearch,
  {
    readonly search: (
      input: GrokSearchInput,
    ) => Effect.Effect<GrokSearchResult, UltimateSearchError, never>;
  }
>()("GrokSearch") {
  //  也可以单独定义成变量或者class上的静态方法
  static readonly layer = Layer.effect(
    GrokSearch,
    Effect.gen(function* () {
      const config = yield* UltimateSearchConfig;
      const provider = yield* GrokProviderClient;
      const grok = yield* config.getGrokConfig();

      const search: GrokSearch.Methods["search"] = Effect.fn("search")(
        function* (input): GrokSearch.Returns<"search"> {
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
        },
      );

      return GrokSearch.of({
        search,
      });
    }),
  );

  // 也可以再定义 live = Layer.provide(xxx.layer, deps) // 无依赖的 Layer<A, E, never>
}

export declare namespace GrokSearch {
  export type Methods = ServiceMap.Service.Shape<typeof GrokSearch>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
