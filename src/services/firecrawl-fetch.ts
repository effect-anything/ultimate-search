import { Effect, Layer, Result, ServiceMap } from "effect";
import { FirecrawlProviderClient } from "../providers/firecrawl/client";
import type { FirecrawlScrapeResponse } from "../providers/firecrawl/schema";
import { ProviderContentError, type UltimateSearchError } from "../shared/errors";
import type { ServicesReturns } from "../shared/effect";
import type { FetchedPage, WebFetchInput } from "./web-fetch-schema";

const normalizeContent = (response: FirecrawlScrapeResponse, format: WebFetchInput["format"]) => {
  const data = response.data;

  if (data == null) {
    return null;
  }

  const preferred = format === "text" ? data.content : data.markdown;
  const fallback = format === "text" ? data.markdown : data.content;
  const content = (preferred ?? fallback ?? "").trim();

  return content.length > 0 ? content : null;
};

export class FirecrawlFetch extends ServiceMap.Service<
  FirecrawlFetch,
  {
    readonly fetch: (
      input: WebFetchInput,
    ) => Effect.Effect<ReadonlyArray<FetchedPage>, UltimateSearchError, never>;
  }
>()("FirecrawlFetch") {
  static readonly layer = Layer.effect(
    FirecrawlFetch,
    Effect.gen(function* () {
      const provider = yield* FirecrawlProviderClient;

      const fetch: FirecrawlFetch.Methods["fetch"] = Effect.fn("FirecrawlFetch.fetch")(
        function* (input): FirecrawlFetch.Returns<"fetch"> {
          const attempts = yield* Effect.forEach(
            input.urls,
            (url) =>
              Effect.result(
                provider.scrape({
                  url,
                  formats: ["markdown"],
                }),
              ).pipe(
                Effect.map((result) => ({
                  url,
                  result,
                })),
              ),
            { concurrency: "unbounded" },
          );

          const successes = attempts.flatMap(({ url, result }) => {
            if (Result.isFailure(result)) {
              return [];
            }

            const rawContent = normalizeContent(result.success, input.format);

            if (rawContent === null) {
              return [];
            }

            return [
              {
                url,
                title: result.success.data?.metadata?.title,
                raw_content: rawContent,
              } satisfies FetchedPage,
            ];
          });

          if (successes.length > 0) {
            return successes;
          }

          const firstFailure = attempts.find(({ result }) => Result.isFailure(result));

          if (firstFailure != null && Result.isFailure(firstFailure.result)) {
            return yield* firstFailure.result.failure;
          }

          return yield* new ProviderContentError({
            provider: "firecrawl",
            message: "FireCrawl returned no extractable content.",
          });
        },
      );

      return FirecrawlFetch.of({
        fetch,
      });
    }),
  );
}

export declare namespace FirecrawlFetch {
  export type Methods = ServiceMap.Service.Shape<typeof FirecrawlFetch>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
