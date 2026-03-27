import { Effect, Layer, ServiceMap } from "effect";
import { TavilyProviderClient } from "../providers/tavily/client.ts";
import { buildTavilyExtractRequest } from "../providers/tavily/schema.ts";
import { ProviderContentError, type UltimateSearchError } from "../shared/errors.ts";
import type { ServicesReturns } from "../shared/effect.ts";
import type { FetchedPage, WebFetchInput } from "./web-fetch-schema.ts";

const normalizeContent = (content: string | null | undefined) => {
  const text = content?.trim() ?? "";
  return text.length > 0 ? text : null;
};

export class TavilyExtract extends ServiceMap.Service<
  TavilyExtract,
  {
    readonly extract: (
      input: WebFetchInput,
    ) => Effect.Effect<ReadonlyArray<FetchedPage>, UltimateSearchError, never>;
  }
>()("TavilyExtract") {
  static readonly layer = Layer.effect(
    TavilyExtract,
    Effect.gen(function* () {
      const provider = yield* TavilyProviderClient;

      const extract: TavilyExtract.Methods["extract"] = Effect.fn("TavilyExtract.extract")(
        function* (input): TavilyExtract.Returns<"extract"> {
          const response = yield* provider.extract(buildTavilyExtractRequest(input));
          const results = response.results.flatMap((item) => {
            const rawContent = normalizeContent(item.raw_content);

            if (rawContent === null) {
              return [];
            }

            return [
              {
                url: item.url,
                title: item.title,
                raw_content: rawContent,
              } satisfies FetchedPage,
            ];
          });

          if (results.length === 0) {
            return yield* new ProviderContentError({
              provider: "tavily",
              message: "Tavily returned no extractable content.",
            });
          }

          return results;
        },
      );

      return TavilyExtract.of({
        extract,
      });
    }),
  );
}

export declare namespace TavilyExtract {
  export type Methods = ServiceMap.Service.Shape<typeof TavilyExtract>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
