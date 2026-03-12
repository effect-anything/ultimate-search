import { Effect, Schema, ServiceMap } from "effect";
import {
  UltimateSearchConfig,
  type UltimateSearchConfigService,
} from "../../config/settings.ts";
import { FetchService, type FetchService as FetchServiceShape } from "../../shared/fetch.ts";
import {
  ProviderDecodeError,
  ProviderRequestError,
  ProviderResponseError,
  type UltimateSearchError,
} from "../../shared/errors.ts";
import {
  GrokChatCompletionRequestSchema,
  type GrokChatCompletionRequest,
  GrokChatCompletionResponseSchema,
  type GrokChatCompletionResponse,
} from "./schema.ts";

export interface GrokProviderClientService {
  readonly createChatCompletion: (
    request: GrokChatCompletionRequest,
  ) => Effect.Effect<
    GrokChatCompletionResponse,
    UltimateSearchError,
    UltimateSearchConfigService | FetchServiceShape
  >;
}

export const GrokProviderClient =
  ServiceMap.Service<GrokProviderClientService>("GrokProviderClient");

const mapRequestError = (error: unknown, fallback: string) =>
  new ProviderRequestError({
    provider: "grok",
    message: error instanceof Error ? error.message : fallback,
  });

const mapDecodeError = (error: unknown, fallback: string) =>
  new ProviderDecodeError({
    provider: "grok",
    message: error instanceof Error ? error.message : fallback,
  });

export const GrokProviderClientLive = GrokProviderClient.of({
  createChatCompletion: (payload) =>
    Effect.gen(function* () {
      const config = yield* UltimateSearchConfig;
      const grok = yield* config.grok;
      const fetchService = yield* FetchService;

      const requestBody = yield* Effect.try({
        try: () =>
          Schema.encodeUnknownSync(
            Schema.fromJsonString(GrokChatCompletionRequestSchema),
          )(payload),
        catch: (error) =>
          mapRequestError(error, "Failed to encode the Grok request payload."),
      });

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
        catch: (error) =>
          mapRequestError(error, "Failed to send the Grok request."),
      });

      const bodyText = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: (error) =>
          mapRequestError(error, "Failed to read the Grok response body."),
      });

      if (!response.ok) {
        return yield* new ProviderResponseError({
          provider: "grok",
          message: `Grok returned HTTP ${response.status}.`,
          status: response.status,
          body: bodyText,
        });
      }

      return yield* Effect.try({
        try: () =>
          Schema.decodeUnknownSync(
            Schema.fromJsonString(GrokChatCompletionResponseSchema),
          )(bodyText),
        catch: (error) =>
          mapDecodeError(error, "Failed to decode the Grok response payload."),
      });
    }),
});
