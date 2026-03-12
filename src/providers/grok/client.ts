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
  GrokChatCompletionRequestSchema,
  type GrokChatCompletionRequest,
  GrokChatCompletionResponseSchema,
  type GrokChatCompletionResponse,
} from "./schema";

const encodeGrokChatCompletionRequest = Schema.encodeUnknownEffect(
  Schema.fromJsonString(GrokChatCompletionRequestSchema),
);

const decodeGrokChatCompletionResponse = Schema.decodeUnknownEffect(
  Schema.fromJsonString(GrokChatCompletionResponseSchema),
);

const mapRequestError = (error: unknown, fallback: string) =>
  new ProviderRequestError({
    provider: "grok",
    message: error instanceof Error ? error.message : fallback,
  });

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
      const fetchService = yield* FetchService;

      const createChatCompletion: GrokProviderClient.Methods["createChatCompletion"] = Effect.fn(
        "GrokProviderClient.createChatCompletion",
      )(function* (payload): GrokProviderClient.Returns<"createChatCompletion"> {
        const grok = yield* config.getGrokConfig();
        const requestBody = yield* encodeGrokChatCompletionRequest(payload).pipe(
          Effect.mapError((error) =>
            mapRequestError(error, "Failed to encode the Grok request payload."),
          ),
        );

        const response = yield* Effect.tryPromise({
          try: () =>
            fetchService.fetch(`${grok.apiUrl}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${grok.apiKey}`,
              },
              body: requestBody,
            }),
          catch: (error) => mapRequestError(error, "Failed to send the Grok request."),
        });

        const bodyText = yield* Effect.tryPromise({
          try: () => response.text(),
          catch: (error) => mapRequestError(error, "Failed to read the Grok response body."),
        });

        if (!response.ok) {
          return yield* new ProviderResponseError({
            provider: "grok",
            message: `Grok returned HTTP ${response.status}.`,
            status: response.status,
            body: bodyText,
          });
        }

        return yield* decodeGrokChatCompletionResponse(bodyText).pipe(
          Effect.mapError((error) =>
            mapDecodeError(error, "Failed to decode the Grok response payload."),
          ),
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
