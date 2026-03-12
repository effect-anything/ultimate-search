import { Effect, Layer, Result, Schema, ServiceMap } from "effect";
import {
  GrokSearchInput,
  GrokSearchResultSchema,
  type GrokSearchResult,
} from "../providers/grok/schema";
import {
  TavilySearchDepthSchema,
  TavilySearchInput,
  TavilySearchResponseSchema,
  type TavilySearchResponse,
  TavilySearchTopicSchema,
  TavilyTimeRangeSchema,
} from "../providers/tavily/schema";
import type { ServicesReturns } from "../shared/effect";
import type { RenderedError } from "../shared/render-error";
import { RenderedErrorSchema, renderStructuredError } from "../shared/render-error";
import { trimmedNonEmptyStringSchema } from "../shared/schema";
import { GrokSearch } from "./grok-search";
import { TavilySearch } from "./tavily-search";

export class DualSearchInput extends Schema.Class<DualSearchInput>("DualSearchInput")({
  query: trimmedNonEmptyStringSchema("query must be a non-empty string"),
  platform: Schema.Option(Schema.NonEmptyString),
  model: Schema.Option(Schema.NonEmptyString),
  searchDepth: Schema.Option(TavilySearchDepthSchema),
  topic: Schema.Option(TavilySearchTopicSchema),
  timeRange: Schema.Option(TavilyTimeRangeSchema),
  maxResults: Schema.Option(
    Schema.Int.pipe(
      Schema.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
      Schema.annotate({
        message: "max-results must be an integer between 1 and 20",
      }),
    ),
  ),
  includeAnswer: Schema.Boolean,
}) {
  static decodeEffect = Schema.decodeUnknownEffect(DualSearchInput);
}

export interface DualSearchProviderSuccess<A> {
  readonly status: "success";
  readonly result: A;
}

export interface DualSearchProviderFailure {
  readonly status: "error";
  readonly error: RenderedError;
}

export type DualSearchProviderResult<A> = DualSearchProviderSuccess<A> | DualSearchProviderFailure;

export interface DualSearchResult {
  readonly grok: DualSearchProviderResult<GrokSearchResult>;
  readonly tavily: DualSearchProviderResult<TavilySearchResponse>;
}

const dualSearchProviderSuccessSchema = <A extends Schema.Top>(resultSchema: A) =>
  Schema.Struct({
    status: Schema.Literal("success"),
    result: resultSchema,
  });

const DualSearchProviderFailureSchema = Schema.Struct({
  status: Schema.Literal("error"),
  error: RenderedErrorSchema,
});

export const DualSearchResultSchema = Schema.Struct({
  grok: Schema.Union([
    dualSearchProviderSuccessSchema(GrokSearchResultSchema),
    DualSearchProviderFailureSchema,
  ]),
  tavily: Schema.Union([
    dualSearchProviderSuccessSchema(TavilySearchResponseSchema),
    DualSearchProviderFailureSchema,
  ]),
});

const toProviderResult = <A, E>(result: Result.Result<A, E>): DualSearchProviderResult<A> =>
  Result.match(result, {
    onSuccess: (value) => ({
      status: "success",
      result: value,
    }),
    onFailure: (error) => ({
      status: "error",
      error: renderStructuredError(error),
    }),
  });

export class DualSearch extends ServiceMap.Service<
  DualSearch,
  {
    readonly search: (input: DualSearchInput) => Effect.Effect<DualSearchResult>;
  }
>()("DualSearch") {
  static readonly layer = Layer.effect(
    DualSearch,
    Effect.gen(function* () {
      const grokSearch = yield* GrokSearch;
      const tavilySearch = yield* TavilySearch;

      const search: DualSearch.Methods["search"] = Effect.fn("DualSearch.search")(
        function* (input): DualSearch.Returns<"search"> {
          const results = yield* Effect.all(
            {
              grok: grokSearch.search(
                yield* GrokSearchInput.decodeEffect({
                  query: input.query,
                  platform: input.platform,
                  model: input.model,
                }).pipe(Effect.orDie),
              ),
              tavily: tavilySearch.search(
                yield* TavilySearchInput.decodeEffect({
                  query: input.query,
                  searchDepth: input.searchDepth,
                  topic: input.topic,
                  timeRange: input.timeRange,
                  maxResults: input.maxResults,
                  includeAnswer: input.includeAnswer,
                }).pipe(Effect.orDie),
              ),
            },
            {
              concurrency: "unbounded",
              mode: "result",
            },
          );

          return {
            grok: toProviderResult(results.grok),
            tavily: toProviderResult(results.tavily),
          };
        },
      );

      return DualSearch.of({
        search,
      });
    }),
  );
}

export declare namespace DualSearch {
  export type Methods = ServiceMap.Service.Shape<typeof DualSearch>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
