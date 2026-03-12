import { Effect, Layer, Schema, ServiceMap } from "effect";
import { UltimateSearchConfig } from "../../config/settings";
import type { ServicesReturns } from "../../shared/effect";
import { FetchService } from "../../shared/fetch";
import {
  ProviderDecodeError,
  ProviderRequestError,
  ProviderResponseError,
  type UltimateSearchError,
} from "../../shared/errors";
import {
  FirecrawlScrapeRequestSchema,
  type FirecrawlScrapeRequest,
  FirecrawlScrapeResponseSchema,
  type FirecrawlScrapeResponse,
} from "./schema";

const encodeFirecrawlScrapeRequest = Schema.encodeUnknownEffect(
  Schema.fromJsonString(FirecrawlScrapeRequestSchema),
);

const decodeFirecrawlScrapeResponse = Schema.decodeUnknownEffect(
  Schema.fromJsonString(FirecrawlScrapeResponseSchema),
);

const mapRequestError = (error: unknown, fallback: string) =>
  new ProviderRequestError({
    provider: "firecrawl",
    message: error instanceof Error ? error.message : fallback,
  });

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
      const fetchService = yield* FetchService;

      const scrape: FirecrawlProviderClient.Methods["scrape"] = Effect.fn(
        "FirecrawlProviderClient.scrape",
      )(function* (payload): FirecrawlProviderClient.Returns<"scrape"> {
        const firecrawl = yield* config.getFirecrawlConfig();
        const requestBody = yield* encodeFirecrawlScrapeRequest(payload).pipe(
          Effect.mapError((error) =>
            mapRequestError(error, "Failed to encode the FireCrawl request payload."),
          ),
        );

        const response = yield* Effect.tryPromise({
          try: () =>
            fetchService.fetch(`${firecrawl.apiUrl}/scrape`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${firecrawl.apiKey}`,
              },
              body: requestBody,
            }),
          catch: (error) => mapRequestError(error, "Failed to send the FireCrawl request."),
        });

        const bodyText = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (error) => mapRequestError(error, "Failed to read the FireCrawl response body."),
        });

        if (!response.ok) {
          return yield* new ProviderResponseError({
            provider: "firecrawl",
            message: `FireCrawl returned HTTP ${response.status}.`,
            status: response.status,
            body: bodyText,
          });
        }

        return yield* decodeFirecrawlScrapeResponse(bodyText).pipe(
          Effect.mapError((error) =>
            mapDecodeError(error, "Failed to decode the FireCrawl response payload."),
          ),
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
