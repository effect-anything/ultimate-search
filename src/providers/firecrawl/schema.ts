import { Schema } from "effect";

export const FirecrawlFormatSchema = Schema.Literals(["markdown"] as const);

export type FirecrawlFormat = typeof FirecrawlFormatSchema.Type;

export const FirecrawlScrapeRequestSchema = Schema.Struct({
  url: Schema.String,
  formats: Schema.NonEmptyArray(FirecrawlFormatSchema),
});

export type FirecrawlScrapeRequest = typeof FirecrawlScrapeRequestSchema.Type;

export const FirecrawlScrapeResponseSchema = Schema.Struct({
  success: Schema.optional(Schema.Boolean),
  data: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        markdown: Schema.optional(Schema.NullOr(Schema.String)),
        content: Schema.optional(Schema.NullOr(Schema.String)),
        metadata: Schema.optional(
          Schema.Struct({
            title: Schema.optional(Schema.NullOr(Schema.String)),
          }),
        ),
      }),
    ),
  ),
});

export type FirecrawlScrapeResponse = typeof FirecrawlScrapeResponseSchema.Type;
