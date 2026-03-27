import { it } from "@effect/vitest";
import { Deferred, Effect, Exit, Layer, Option } from "effect";
import { expect } from "vitest";
import { ProviderResponseError } from "../src/shared/errors.ts";
import { DualSearch, DualSearchInput } from "../src/services/dual-search.ts";
import { GrokSearch } from "../src/services/grok-search.ts";
import { TavilySearch } from "../src/services/tavily-search.ts";

const makeInput = () =>
  DualSearchInput.decodeEffect({
    query: "FastAPI releases",
    platform: Option.none<string>(),
    model: Option.none<string>(),
    searchDepth: Option.none<"basic" | "advanced">(),
    topic: Option.none<"general" | "news" | "finance">(),
    timeRange: Option.none<"day" | "week" | "month" | "year">(),
    maxResults: Option.none<number>(),
    includeAnswer: false,
  });

const testLayer = Layer.empty;

const makeDualSearchMockLayer = (
  grokLayer: Layer.Layer<any, any, any>,
  tavilyLayer: Layer.Layer<any, any, any>,
) => DualSearch.layer.pipe(Layer.provideMerge(grokLayer), Layer.provideMerge(tavilyLayer));

it.layer(testLayer)((it) => {
  it.effect(
    "runs both provider branches concurrently",
    Effect.fn(function* () {
      const grokStarted = yield* Deferred.make<void>();
      const tavilyStarted = yield* Deferred.make<void>();
      const grokLayer = Layer.succeed(
        GrokSearch,
        GrokSearch.of({
          search: () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(grokStarted, void 0);
              yield* Deferred.await(tavilyStarted);

              return {
                content: "Grok summary",
                model: "grok-test",
                usage: {
                  prompt_tokens: 12,
                  completion_tokens: 8,
                  total_tokens: 20,
                },
              };
            }),
        }),
      );
      const tavilyLayer = Layer.succeed(
        TavilySearch,
        TavilySearch.of({
          search: () =>
            Effect.gen(function* () {
              yield* Deferred.succeed(tavilyStarted, void 0);
              yield* Deferred.await(grokStarted);

              return {
                query: "FastAPI releases",
                answer: "Tavily answer",
                response_time: 0.21,
                results: [],
              };
            }),
        }),
      );
      const mockLayer = makeDualSearchMockLayer(grokLayer, tavilyLayer);
      const exit = yield* Effect.exit(
        Effect.gen(function* () {
          const dualSearch = yield* DualSearch;

          return yield* dualSearch.search(yield* makeInput()).pipe(Effect.timeout("1 second"));
        }).pipe(Effect.provide(mockLayer)),
      );

      expect(Exit.isSuccess(exit)).toBe(true);

      if (Exit.isSuccess(exit)) {
        expect(exit.value.grok).toEqual({
          status: "success",
          result: {
            content: "Grok summary",
            model: "grok-test",
            usage: {
              prompt_tokens: 12,
              completion_tokens: 8,
              total_tokens: 20,
            },
          },
        });
        expect(exit.value.tavily).toEqual({
          status: "success",
          result: {
            query: "FastAPI releases",
            answer: "Tavily answer",
            response_time: 0.21,
            results: [],
          },
        });
      }
    }),
  );

  it.effect(
    "preserves mixed success and failure in the combined result",
    Effect.fn(function* () {
      const grokLayer = Layer.succeed(
        GrokSearch,
        GrokSearch.of({
          search: () =>
            Effect.fail(
              new ProviderResponseError({
                provider: "grok",
                message: "Grok returned HTTP 503.",
                status: 503,
                body: "provider unavailable",
              }),
            ),
        }),
      );
      const tavilyLayer = Layer.succeed(
        TavilySearch,
        TavilySearch.of({
          search: () =>
            Effect.succeed({
              query: "FastAPI releases",
              answer: null,
              response_time: 0.11,
              results: [],
            }),
        }),
      );
      const mockLayer = makeDualSearchMockLayer(grokLayer, tavilyLayer);
      const result = yield* Effect.gen(function* () {
        const dualSearch = yield* DualSearch;

        return yield* dualSearch.search(yield* makeInput());
      }).pipe(Effect.provide(mockLayer));

      expect(result).toEqual({
        grok: {
          status: "error",
          error: {
            type: "ProviderResponseError",
            provider: "grok",
            message: "Grok returned HTTP 503.",
            status: 503,
            body: "provider unavailable",
          },
        },
        tavily: {
          status: "success",
          result: {
            query: "FastAPI releases",
            answer: null,
            response_time: 0.11,
            results: [],
          },
        },
      });
    }),
  );
});
