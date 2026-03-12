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
  type GrokChatCompletionRequest,
  GrokChatCompletionResponseSchema,
  type GrokChatCompletionResponse,
} from "./schema";

const decodeGrokChatCompletionResponse = Schema.decodeUnknownEffect(
  GrokChatCompletionResponseSchema,
);

const mapDecodeError = (error: unknown, fallback: string) =>
  new ProviderDecodeError({
    provider: "grok",
    message: error instanceof Error ? error.message : fallback,
    cause: error,
  });

export class GrokProviderClient extends ServiceMap.Service<
  GrokProviderClient,
  {
    readonly createChatCompletion: (
      request: GrokChatCompletionRequest,
    ) => Effect.Effect<GrokChatCompletionResponse, UltimateSearchError, never>;
  }
>()("GrokProviderClient") {
  static readonly layer = Layer.effect(
    GrokProviderClient,
    Effect.gen(function* () {
      const config = yield* UltimateSearchConfig;
      const httpClient = makeProviderHttpClient(yield* HttpClient.HttpClient);

      const createChatCompletion: GrokProviderClient.Methods["createChatCompletion"] = Effect.fn(
        "GrokProviderClient.createChatCompletion",
      )(function* (payload): GrokProviderClient.Returns<"createChatCompletion"> {
        const grok = yield* config.getGrokConfig();
        const request = HttpClientRequest.post(`${grok.apiUrl}/v1/chat/completions`).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bearerToken(grok.apiKey),
          HttpClientRequest.bodyJsonUnsafe(payload),
        );

        const response = yield* httpClient
          .execute(request)
          .pipe(
            catchProviderHttpError(
              "grok",
              "Failed to send the Grok request.",
              (status: number) => `Grok returned HTTP ${status}.`,
            ),
          );

        return yield* decodeJsonResponse(response, decodeGrokChatCompletionResponse, (error) =>
          mapDecodeError(error, "Failed to decode the Grok response payload."),
        );
      });

      return GrokProviderClient.of({
        createChatCompletion,
      });
    }),
  );
}

export declare namespace GrokProviderClient {
  export type Methods = ServiceMap.Service.Shape<typeof GrokProviderClient>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
