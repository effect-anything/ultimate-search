import { Option, Schema } from "effect";
import { trimmedNonEmptyStringSchema } from "../../shared/schema";

export const TavilySearchDepthSchema = Schema.Literals(["basic", "advanced"] as const);

export type TavilySearchDepth = typeof TavilySearchDepthSchema.Type;

export const TavilySearchTopicSchema = Schema.Literals(["general", "news", "finance"] as const);

export type TavilySearchTopic = typeof TavilySearchTopicSchema.Type;

export const TavilyTimeRangeSchema = Schema.Literals(["day", "week", "month", "year"] as const);

export type TavilyTimeRange = typeof TavilyTimeRangeSchema.Type;

const maxResultsSchema = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
  Schema.annotate({
    message: "max-results must be an integer between 1 and 20",
  }),
);

const responseTimeSchema = Schema.Union([Schema.Number, Schema.NumberFromString]);

export const TavilySearchRequestSchema = Schema.Struct({
  query: Schema.NonEmptyString,
  search_depth: Schema.optional(TavilySearchDepthSchema),
  topic: Schema.optional(TavilySearchTopicSchema),
  time_range: Schema.optional(TavilyTimeRangeSchema),
  max_results: Schema.optional(maxResultsSchema),
  include_answer: Schema.optional(Schema.Boolean),
});

export type TavilySearchRequest = typeof TavilySearchRequestSchema.Type;

export const TavilySearchResultItemSchema = Schema.Struct({
  title: Schema.String,
  url: Schema.String,
  content: Schema.String,
  score: Schema.Number,
  raw_content: Schema.optional(Schema.NullOr(Schema.String)),
});

export type TavilySearchResultItem = typeof TavilySearchResultItemSchema.Type;

export const TavilySearchResponseSchema = Schema.Struct({
  query: Schema.String,
  answer: Schema.optional(Schema.NullOr(Schema.String)),
  images: Schema.optional(Schema.Array(Schema.String)),
  response_time: Schema.optional(responseTimeSchema),
  results: Schema.Array(TavilySearchResultItemSchema),
});

export type TavilySearchResponse = typeof TavilySearchResponseSchema.Type;

export class TavilySearchInput extends Schema.Class<TavilySearchInput>("TavilySearchInput")({
  query: trimmedNonEmptyStringSchema("query must be a non-empty string"),
  searchDepth: Schema.Option(TavilySearchDepthSchema),
  topic: Schema.Option(TavilySearchTopicSchema),
  timeRange: Schema.Option(TavilyTimeRangeSchema),
  maxResults: Schema.Option(maxResultsSchema),
  includeAnswer: Schema.Boolean,
}) {
  static decodeEffect = Schema.decodeUnknownEffect(TavilySearchInput)
}

export const buildTavilySearchRequest = (input: TavilySearchInput): TavilySearchRequest => ({
  query: input.query,
  ...(Option.isSome(input.searchDepth) && {
    search_depth: input.searchDepth.value,
  }),
  ...(Option.isSome(input.topic) && {
    topic: input.topic.value,
  }),
  ...(Option.isSome(input.timeRange) && {
    time_range: input.timeRange.value,
  }),
  ...(Option.isSome(input.maxResults) && {
    max_results: input.maxResults.value,
  }),
  ...(input.includeAnswer ? { include_answer: true } : {}),
});
