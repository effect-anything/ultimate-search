import { Effect, Layer, ServiceMap } from "effect";
import { TavilyProviderClient } from "../providers/tavily/client.ts";
import {
  buildTavilyMapRequest,
  TavilyMapInput,
  type TavilyMapResponse,
} from "../providers/tavily/schema.ts";
import type { UltimateSearchError } from "../shared/errors.ts";
import type { ServicesReturns } from "../shared/effect.ts";

export class TavilyMap extends ServiceMap.Service<
  TavilyMap,
  {
    readonly map: (
      input: TavilyMapInput,
    ) => Effect.Effect<TavilyMapResponse, UltimateSearchError, never>;
  }
>()("TavilyMap") {
  static readonly layer = Layer.effect(
    TavilyMap,
    Effect.gen(function* () {
      const provider = yield* TavilyProviderClient;

      const map: TavilyMap.Methods["map"] = Effect.fn("TavilyMap.map")(function* (input) {
        return yield* provider.map(buildTavilyMapRequest(input));
      });

      return TavilyMap.of({
        map,
      });
    }),
  );
}

export declare namespace TavilyMap {
  export type Methods = ServiceMap.Service.Shape<typeof TavilyMap>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
