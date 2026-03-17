import { Effect, Layer, Result, ServiceMap } from "effect";
import {
  ConfigValidationError,
  ProviderContentError,
  ProviderDecodeError,
  ProviderRequestError,
  ProviderResponseError,
  type UltimateSearchError,
} from "../shared/errors";
import type { ServicesReturns } from "../shared/effect";
import { FirecrawlFetch } from "./firecrawl-fetch";
import type { FallbackReason, WebFetchInput, WebFetchResult } from "./web-fetch-schema";
import { TavilyExtract } from "./tavily-extract";

const summarizeFallbackReason = (error: UltimateSearchError): FallbackReason => {
  if (
    error instanceof ConfigValidationError ||
    error instanceof ProviderRequestError ||
    error instanceof ProviderResponseError ||
    error instanceof ProviderDecodeError ||
    error instanceof ProviderContentError
  ) {
    return {
      type: error._tag,
      provider: error.provider,
      message: error.message,
    };
  }

  return {
    type: "UnknownError",
    provider: "shared",
    message: String(error),
  };
};

const resolveDoubleFailure = (
  primary: UltimateSearchError,
  fallback: UltimateSearchError,
): UltimateSearchError =>
  fallback instanceof ConfigValidationError && !(primary instanceof ConfigValidationError)
    ? primary
    : fallback;

export class WebFetch extends ServiceMap.Service<
  WebFetch,
  {
    readonly fetch: (
      input: WebFetchInput,
    ) => Effect.Effect<WebFetchResult, UltimateSearchError, never>;
  }
>()("WebFetch") {
  static readonly layer = Layer.effect(
    WebFetch,
    Effect.gen(function* () {
      const tavilyExtract = yield* TavilyExtract;
      const firecrawlFetch = yield* FirecrawlFetch;

      const fetch: WebFetch.Methods["fetch"] = Effect.fn("WebFetch.fetch")(
        function* (input): WebFetch.Returns<"fetch"> {
          const tavilyAttempt = yield* Effect.result(tavilyExtract.extract(input));

          if (Result.isSuccess(tavilyAttempt)) {
            return {
              backend: "tavily",
              format: input.format,
              results: tavilyAttempt.success,
            } satisfies WebFetchResult;
          }

          const firecrawlAttempt = yield* Effect.result(firecrawlFetch.fetch(input));

          if (Result.isSuccess(firecrawlAttempt)) {
            return {
              backend: "firecrawl",
              format: input.format,
              results: firecrawlAttempt.success,
              fallback: {
                from: "tavily",
                to: "firecrawl",
                reason: summarizeFallbackReason(tavilyAttempt.failure),
              },
            } satisfies WebFetchResult;
          }

          return yield* resolveDoubleFailure(tavilyAttempt.failure, firecrawlAttempt.failure);
        },
      );

      return WebFetch.of({
        fetch,
      });
    }),
  );
}

export declare namespace WebFetch {
  export type Methods = ServiceMap.Service.Shape<typeof WebFetch>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
