import { Effect, Layer, Schema, ServiceMap } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { UltimateSearchConfig } from "../../config/settings.ts";
import type { ServicesReturns } from "../../shared/effect.ts";
import { ProviderDecodeError, type UltimateSearchError } from "../../shared/errors.ts";
import {
  catchProviderHttpError,
  decodeJsonResponse,
  makeProviderHttpClient,
} from "../../shared/provider-http-client.ts";
import {
  type TavilyMapRequest,
  TavilyMapResponseSchema,
  type TavilyMapResponse,
  type TavilyExtractRequest,
  TavilyExtractResponseSchema,
  type TavilyExtractResponse,
  type TavilySearchRequest,
  TavilySearchResponseSchema,
  type TavilySearchResponse,
} from "./schema.ts";

const decodeTavilySearchResponse = Schema.decodeUnknownEffect(TavilySearchResponseSchema);

const decodeTavilyMapResponse = Schema.decodeUnknownEffect(TavilyMapResponseSchema);

const decodeTavilyExtractResponse = Schema.decodeUnknownEffect(TavilyExtractResponseSchema);

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
    readonly map: (
      request: TavilyMapRequest,
    ) => Effect.Effect<TavilyMapResponse, UltimateSearchError, never>;
    readonly extract: (
      request: TavilyExtractRequest,
    ) => Effect.Effect<TavilyExtractResponse, UltimateSearchError, never>;
  }
>()("TavilyProviderClient") {
  static readonly layer = Layer.effect(
    TavilyProviderClient,
    Effect.gen(function* () {
      const config = yield* UltimateSearchConfig;
      const http = makeProviderHttpClient(yield* HttpClient.HttpClient);

      const search: TavilyProviderClient.Methods["search"] = Effect.fn(
        "TavilyProviderClient.search",
      )(function* (payload): TavilyProviderClient.Returns<"search"> {
        const tavily = yield* config.getTavilyConfig();
        const request = HttpClientRequest.post(`${tavily.apiUrl}/search`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(tavily.apiKey),
          HttpClientRequest.bodyJsonUnsafe(payload),
        );

        const response = yield* http
          .execute(request)
          .pipe(
            catchProviderHttpError(
              "tavily",
              "Failed to send the Tavily request.",
              (status: number) => `Tavily returned HTTP ${status}.`,
            ),
          );

        return yield* decodeJsonResponse(response, decodeTavilySearchResponse, (error) =>
          mapDecodeError(error, "Failed to decode the Tavily response payload."),
        );
      });

      const map: TavilyProviderClient.Methods["map"] = Effect.fn("TavilyProviderClient.map")(
        function* (payload): TavilyProviderClient.Returns<"map"> {
          const tavily = yield* config.getTavilyConfig();
          const request = HttpClientRequest.post(`${tavily.apiUrl}/map`).pipe(
            HttpClientRequest.acceptJson,
            HttpClientRequest.bearerToken(tavily.apiKey),
            HttpClientRequest.bodyJsonUnsafe(payload),
          );

          const response = yield* http
            .execute(request)
            .pipe(
              catchProviderHttpError(
                "tavily",
                "Failed to send the Tavily map request.",
                (status: number) => `Tavily map returned HTTP ${status}.`,
              ),
            );

          return yield* decodeJsonResponse(response, decodeTavilyMapResponse, (error) =>
            mapDecodeError(error, "Failed to decode the Tavily map response payload."),
          );
        },
      );

      const extract: TavilyProviderClient.Methods["extract"] = Effect.fn(
        "TavilyProviderClient.extract",
      )(function* (payload): TavilyProviderClient.Returns<"extract"> {
        const tavily = yield* config.getTavilyConfig();
        const request = HttpClientRequest.post(`${tavily.apiUrl}/extract`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(tavily.apiKey),
          HttpClientRequest.bodyJsonUnsafe(payload),
        );

        const response = yield* http
          .execute(request)
          .pipe(
            catchProviderHttpError(
              "tavily",
              "Failed to send the Tavily extract request.",
              (status: number) => `Tavily returned HTTP ${status}.`,
            ),
          );

        return yield* decodeJsonResponse(response, decodeTavilyExtractResponse, (error) =>
          mapDecodeError(error, "Failed to decode the Tavily extract payload."),
        );
      });

      return TavilyProviderClient.of({
        map,
        search,
        extract,
      });
    }),
  );
}

export declare namespace TavilyProviderClient {
  export type Methods = ServiceMap.Service.Shape<typeof TavilyProviderClient>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
