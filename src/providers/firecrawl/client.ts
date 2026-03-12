import { Effect, Layer, Schema, ServiceMap } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { UltimateSearchConfig } from "../../config/settings";
import type { ServicesReturns } from "../../shared/effect";
import { ProviderDecodeError, type UltimateSearchError } from "../../shared/errors";
import {
  catchProviderHttpError,
  decodeJsonResponse,
  makeProviderHttpClient,
} from "../../shared/provider-http-client";
import {
  type FirecrawlScrapeRequest,
  FirecrawlScrapeResponseSchema,
  type FirecrawlScrapeResponse,
} from "./schema";

const decodeFirecrawlScrapeResponse = Schema.decodeUnknownEffect(FirecrawlScrapeResponseSchema);

const mapDecodeError = (error: unknown, fallback: string) =>
  new ProviderDecodeError({
    provider: "firecrawl",
    message: error instanceof Error ? error.message : fallback,
    cause: error,
  });

export class FirecrawlProviderClient extends ServiceMap.Service<
  FirecrawlProviderClient,
  {
    readonly scrape: (
      request: FirecrawlScrapeRequest,
    ) => Effect.Effect<FirecrawlScrapeResponse, UltimateSearchError, never>;
  }
>()("FirecrawlProviderClient") {
  static readonly layer = Layer.effect(
    FirecrawlProviderClient,
    Effect.gen(function* () {
      const config = yield* UltimateSearchConfig;
      const http = makeProviderHttpClient(yield* HttpClient.HttpClient);

      const scrape: FirecrawlProviderClient.Methods["scrape"] = Effect.fn(
        "FirecrawlProviderClient.scrape",
      )(function* (payload): FirecrawlProviderClient.Returns<"scrape"> {
        const firecrawl = yield* config.getFirecrawlConfig();
        const request = HttpClientRequest.post(`${firecrawl.apiUrl}/scrape`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(firecrawl.apiKey),
          HttpClientRequest.bodyJsonUnsafe(payload),
        );

        const response = yield* http
          .execute(request)
          .pipe(
            catchProviderHttpError(
              "firecrawl",
              "Failed to send the FireCrawl request.",
              (status: number) => `FireCrawl returned HTTP ${status}.`,
            ),
          );

        return yield* decodeJsonResponse(response, decodeFirecrawlScrapeResponse, (error) =>
          mapDecodeError(error, "Failed to decode the FireCrawl response payload."),
        );
      });

      return FirecrawlProviderClient.of({
        scrape,
      });
    }),
  );
}

export declare namespace FirecrawlProviderClient {
  export type Methods = ServiceMap.Service.Shape<typeof FirecrawlProviderClient>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
