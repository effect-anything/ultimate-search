import { Option, Schema } from "effect";
import { absoluteUrlStringSchema, trimmedNonEmptyStringSchema } from "../../shared/schema";

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

export const TavilyMapDepthSchema = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
  Schema.annotate({
    message: "depth must be an integer between 1 and 5",
  }),
);

export type TavilyMapDepth = typeof TavilyMapDepthSchema.Type;

export const TavilyMapBreadthSchema = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 500 })),
  Schema.annotate({
    message: "breadth must be an integer between 1 and 500",
  }),
);

export type TavilyMapBreadth = typeof TavilyMapBreadthSchema.Type;

export const TavilyMapLimitSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(1)),
  Schema.annotate({
    message: "limit must be an integer greater than or equal to 1",
  }),
);

export type TavilyMapLimit = typeof TavilyMapLimitSchema.Type;

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

export const TavilyMapRequestSchema = Schema.Struct({
  url: Schema.String,
  max_depth: Schema.optional(TavilyMapDepthSchema),
  max_breadth: Schema.optional(TavilyMapBreadthSchema),
  limit: Schema.optional(TavilyMapLimitSchema),
  instructions: Schema.optional(Schema.NonEmptyString),
});

export type TavilyMapRequest = typeof TavilyMapRequestSchema.Type;

export const TavilyMapUsageSchema = Schema.Struct({
  credits_used: Schema.optional(Schema.Number),
});

export type TavilyMapUsage = typeof TavilyMapUsageSchema.Type;

export const TavilyMapResponseSchema = Schema.Struct({
  base_url: Schema.String,
  results: Schema.Array(Schema.String),
  response_time: Schema.optional(responseTimeSchema),
  request_id: Schema.optional(Schema.String),
  usage: Schema.optional(TavilyMapUsageSchema),
});

export type TavilyMapResponse = typeof TavilyMapResponseSchema.Type;

export class TavilyMapInput extends Schema.Class<TavilyMapInput>("TavilyMapInput")({
  url: absoluteUrlStringSchema("url must be an absolute URL"),
  depth: Schema.Option(TavilyMapDepthSchema),
  breadth: Schema.Option(TavilyMapBreadthSchema),
  limit: Schema.Option(TavilyMapLimitSchema),
  instructions: Schema.Option(trimmedNonEmptyStringSchema("instructions must be a non-empty string")),
}) {
  static decodeEffect = Schema.decodeUnknownEffect(TavilyMapInput)
}

export const buildTavilyMapRequest = (input: TavilyMapInput): TavilyMapRequest => ({
  url: input.url,
  ...(Option.isSome(input.depth) && {
    max_depth: input.depth.value,
  }),
  ...(Option.isSome(input.breadth) && {
    max_breadth: input.breadth.value,
  }),
  ...(Option.isSome(input.limit) && {
    limit: input.limit.value,
  }),
  ...(Option.isSome(input.instructions) && {
    instructions: input.instructions.value,
  }),
});
