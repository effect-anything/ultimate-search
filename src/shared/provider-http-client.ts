import { Effect } from "effect";
import { HttpClient, HttpClientError, type HttpClientResponse } from "effect/unstable/http";
import { ProviderRequestError, ProviderResponseError } from "./errors.ts";

export type ProviderHttpClientName = "shared" | "grok" | "tavily" | "firecrawl";

export const mapProviderRequestError = (
  provider: ProviderHttpClientName,
  error: unknown,
  fallback: string,
) =>
  new ProviderRequestError({
    provider,
    message: error instanceof Error && error.message.length > 0 ? error.message : fallback,
  });

export const makeProviderHttpClient = (
  client: HttpClient.HttpClient,
): HttpClient.HttpClient.With<HttpClientError.HttpClientError, never> =>
  client.pipe(
    HttpClient.filterStatusOk,
    HttpClient.retryTransient({
      retryOn: "errors-and-responses",
      times: 2,
    }),
  ) as HttpClient.HttpClient.With<HttpClientError.HttpClientError, never>;

export const catchProviderHttpError =
  (
    provider: ProviderHttpClientName,
    requestErrorMessage: string,
    responseErrorMessage: (status: number) => string,
  ) =>
  <A>(
    effect: Effect.Effect<A, HttpClientError.HttpClientError, never>,
  ): Effect.Effect<A, ProviderRequestError | ProviderResponseError, never> =>
    effect.pipe(
      Effect.catchTag(
        "HttpClientError",
        (error): Effect.Effect<never, ProviderRequestError | ProviderResponseError, never> => {
          const response = error.response;

          if (response === undefined) {
            return Effect.fail(mapProviderRequestError(provider, error, requestErrorMessage));
          }

          return response.text.pipe(
            Effect.catch(() => Effect.succeed("")),
            Effect.flatMap((body) =>
              Effect.fail(
                new ProviderResponseError({
                  provider,
                  message: responseErrorMessage(response.status),
                  status: response.status,
                  body,
                  cause: error,
                }),
              ),
            ),
          );
        },
      ),
    );

export const decodeJsonResponse = <A, E1, E2>(
  response: HttpClientResponse.HttpClientResponse,
  decode: (value: unknown) => Effect.Effect<A, E1, never>,
  mapDecodeError: (error: unknown) => E2,
): Effect.Effect<A, E2, never> =>
  response.json.pipe(
    Effect.mapError(mapDecodeError),
    Effect.flatMap((json) => decode(json).pipe(Effect.mapError(mapDecodeError))),
  );
