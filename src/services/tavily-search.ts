import { Effect, Layer, ServiceMap } from "effect";
import { TavilyProviderClient } from "../providers/tavily/client";
import {
  buildTavilySearchRequest,
  TavilySearchInput,
  type TavilySearchResponse,
} from "../providers/tavily/schema";
import type { UltimateSearchError } from "../shared/errors";
import type { ServicesReturns } from "../shared/effect";

export class TavilySearch extends ServiceMap.Service<
  TavilySearch,
  {
    readonly search: (
      input: TavilySearchInput,
    ) => Effect.Effect<TavilySearchResponse, UltimateSearchError, never>;
  }
>()("TavilySearch") {
  static readonly layer = Layer.effect(
    TavilySearch,
    Effect.gen(function* () {
      const provider = yield* TavilyProviderClient;

      const search: TavilySearch.Methods["search"] = Effect.fn("TavilySearch.search")(
        function* (input): TavilySearch.Returns<"search"> {
          return yield* provider.search(buildTavilySearchRequest(input));
        },
      );

      return TavilySearch.of({
        search,
      });
    }),
  );
}

export declare namespace TavilySearch {
  export type Methods = ServiceMap.Service.Shape<typeof TavilySearch>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
