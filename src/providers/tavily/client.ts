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
  TavilySearchRequestSchema,
  type TavilySearchRequest,
  TavilySearchResponseSchema,
  type TavilySearchResponse,
} from "./schema";

const encodeTavilySearchRequest = Schema.encodeUnknownEffect(
  Schema.fromJsonString(TavilySearchRequestSchema),
);

const decodeTavilySearchResponse = Schema.decodeUnknownEffect(
  Schema.fromJsonString(TavilySearchResponseSchema),
);

const mapRequestError = (error: unknown, fallback: string) =>
  new ProviderRequestError({
    provider: "tavily",
    message: error instanceof Error ? error.message : fallback,
  });

const mapDecodeError = (error: unknown, fallback: string) =>
  new ProviderDecodeError({
    provider: "tavily",
    message: error instanceof Error ? error.message : fallback,
    cause: error,
  });

export class TavilyProviderClient extends ServiceMap.Service<
  TavilyProviderClient,
  {
    readonly search: (
      request: TavilySearchRequest,
    ) => Effect.Effect<TavilySearchResponse, UltimateSearchError, never>;
  }
>()("TavilyProviderClient") {
  static readonly layer = Layer.effect(
    TavilyProviderClient,
    Effect.gen(function* () {
      const config = yield* UltimateSearchConfig;
      const tavily = yield* config.getTavilyConfig();
      const fetchService = yield* FetchService;

      const search: TavilyProviderClient.Methods["search"] = Effect.fn(
        "TavilyProviderClient.search",
      )(function* (payload): TavilyProviderClient.Returns<"search"> {
        const requestBody = yield* encodeTavilySearchRequest(payload).pipe(
          Effect.mapError((error) =>
            mapRequestError(error, "Failed to encode the Tavily request payload."),
          ),
        );

        const response = yield* Effect.tryPromise({
          try: () =>
            fetchService.fetch(`${tavily.apiUrl}/search`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${tavily.apiKey}`,
              },
              body: requestBody,
            }),
          catch: (error) => mapRequestError(error, "Failed to send the Tavily request."),
        });

        const bodyText = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (error) => mapRequestError(error, "Failed to read the Tavily response body."),
        });

        if (!response.ok) {
          return yield* new ProviderResponseError({
            provider: "tavily",
            message: `Tavily returned HTTP ${response.status}.`,
            status: response.status,
            body: bodyText,
          });
        }

        return yield* decodeTavilySearchResponse(bodyText).pipe(
          Effect.mapError((error) =>
            mapDecodeError(error, "Failed to decode the Tavily response payload."),
          ),
        );
      });

      return TavilyProviderClient.of({
        search,
      });
    }),
  );
}

export declare namespace TavilyProviderClient {
  export type Methods = ServiceMap.Service.Shape<typeof TavilyProviderClient>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
