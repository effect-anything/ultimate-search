import { Schema } from "effect";
import {
  FetchContentFormatSchema,
  TavilyExtractDepthSchema,
  type FetchContentFormat,
} from "../providers/tavily/schema";
import { SearchProvider } from "../shared/errors";
import { absoluteUrlStringSchema } from "../shared/schema";

export const FetchBackendSchema = Schema.Literals(["tavily", "firecrawl"] as const);

export type FetchBackend = typeof FetchBackendSchema.Type;

export class WebFetchInput extends Schema.Class<WebFetchInput>("WebFetchInput")({
  urls: Schema.NonEmptyArray(
    absoluteUrlStringSchema("url must be an absolute URL"),
  ),
  depth: TavilyExtractDepthSchema,
  format: FetchContentFormatSchema,
}) {
  static decodeEffect = Schema.decodeUnknownEffect(WebFetchInput);
}

export interface FetchedPage {
  readonly url: string;
  readonly title?: string | null | undefined;
  readonly raw_content: string;
}

export const FetchedPageSchema = Schema.Struct({
  url: Schema.String,
  title: Schema.optional(Schema.NullOr(Schema.String)),
  raw_content: Schema.String,
});

export interface FallbackReason {
  readonly type: string;
  readonly provider: typeof SearchProvider.Type;
  readonly message: string;
}

export const FallbackReasonSchema = Schema.Struct({
  type: Schema.String,
  provider: SearchProvider,
  message: Schema.String,
});

export interface FetchFallback {
  readonly from: "tavily";
  readonly to: "firecrawl";
  readonly reason: FallbackReason;
}

export const FetchFallbackSchema = Schema.Struct({
  from: Schema.Literal("tavily"),
  to: Schema.Literal("firecrawl"),
  reason: FallbackReasonSchema,
});

export interface WebFetchResult {
  readonly backend: FetchBackend;
  readonly format: FetchContentFormat;
  readonly results: ReadonlyArray<FetchedPage>;
  readonly fallback?: FetchFallback | undefined;
}

export const WebFetchResultSchema = Schema.Struct({
  backend: FetchBackendSchema,
  format: FetchContentFormatSchema,
  results: Schema.NonEmptyArray(FetchedPageSchema),
  fallback: Schema.optional(FetchFallbackSchema),
});

export type WebFetchFormat = FetchContentFormat;
