import { Effect, Layer, Option, Schema } from "effect";
import { McpServer, Tool, Toolkit } from "effect/unstable/ai";
import { UltimateSearchConfig } from "../config/settings";
import { GrokSearchInput, GrokSearchResultSchema } from "../providers/grok/schema";
import { GrokProviderClient } from "../providers/grok/client";
import {
  FetchContentFormatSchema,
  TavilyMapBreadthSchema,
  TavilyMapDepthSchema,
  TavilyMapInput,
  TavilyMapLimitSchema,
  TavilyMapResponseSchema,
  TavilySearchDepthSchema,
  TavilySearchInput,
  TavilySearchResponseSchema,
  TavilySearchTopicSchema,
  TavilyTimeRangeSchema,
} from "../providers/tavily/schema";
import { TavilyProviderClient } from "../providers/tavily/client";
import { FirecrawlProviderClient } from "../providers/firecrawl/client";
import { DualSearch, DualSearchInput, DualSearchResultSchema } from "./dual-search";
import { FirecrawlFetch } from "./firecrawl-fetch";
import { GrokSearch } from "./grok-search";
import { TavilyMap } from "./tavily-map";
import { TavilyExtract } from "./tavily-extract";
import { TavilySearch } from "./tavily-search";
import { WebFetch } from "./web-fetch";
import { WebFetchInput, WebFetchResultSchema } from "./web-fetch-schema";
import { RenderedErrorSchema, renderStructuredError } from "../shared/render-error";
import { absoluteUrlStringSchema, trimmedNonEmptyStringSchema } from "../shared/schema";

const optionalTrimmedTextField = (message: string) =>
  Schema.optional(trimmedNonEmptyStringSchema(message));

const toOption = <A>(value: A | undefined) =>
  value === undefined ? Option.none<A>() : Option.some(value);

const SearchGrokParametersSchema = Schema.Struct({
  query: trimmedNonEmptyStringSchema("query must be a non-empty string"),
  platform: optionalTrimmedTextField("platform must be a non-empty string"),
  model: optionalTrimmedTextField("model must be a non-empty string"),
});

const SearchTavilyParametersSchema = Schema.Struct({
  query: trimmedNonEmptyStringSchema("query must be a non-empty string"),
  depth: Schema.optional(TavilySearchDepthSchema),
  maxResults: Schema.optional(
    Schema.Int.pipe(
      Schema.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
      Schema.annotate({
        message: "maxResults must be an integer between 1 and 20",
      }),
    ),
  ),
  topic: Schema.optional(TavilySearchTopicSchema),
  timeRange: Schema.optional(TavilyTimeRangeSchema),
  includeAnswer: Schema.optional(Schema.Boolean),
});

const SearchDualParametersSchema = Schema.Struct({
  query: trimmedNonEmptyStringSchema("query must be a non-empty string"),
  platform: optionalTrimmedTextField("platform must be a non-empty string"),
  model: optionalTrimmedTextField("model must be a non-empty string"),
  depth: Schema.optional(TavilySearchDepthSchema),
  maxResults: Schema.optional(
    Schema.Int.pipe(
      Schema.check(Schema.isBetween({ minimum: 1, maximum: 20 })),
      Schema.annotate({
        message: "maxResults must be an integer between 1 and 20",
      }),
    ),
  ),
  topic: Schema.optional(TavilySearchTopicSchema),
  timeRange: Schema.optional(TavilyTimeRangeSchema),
  includeAnswer: Schema.optional(Schema.Boolean),
});

const FetchParametersSchema = Schema.Struct({
  url: absoluteUrlStringSchema("url must be an absolute URL"),
  depth: Schema.optional(TavilySearchDepthSchema),
  format: Schema.optional(FetchContentFormatSchema),
});

const MapParametersSchema = Schema.Struct({
  url: absoluteUrlStringSchema("url must be an absolute URL"),
  depth: Schema.optional(TavilyMapDepthSchema),
  breadth: Schema.optional(TavilyMapBreadthSchema),
  limit: Schema.optional(TavilyMapLimitSchema),
  instructions: optionalTrimmedTextField("instructions must be a non-empty string"),
});

const searchGrokTool = Tool.make("search_grok", {
  description: "Run the Grok-backed search flow used by the CLI.",
  parameters: SearchGrokParametersSchema,
  success: GrokSearchResultSchema,
  failure: RenderedErrorSchema,
  failureMode: "return",
})
  .annotate(Tool.Title, "Search Grok")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const searchTavilyTool = Tool.make("search_tavily", {
  description: "Run the Tavily-backed search flow used by the CLI.",
  parameters: SearchTavilyParametersSchema,
  success: TavilySearchResponseSchema,
  failure: RenderedErrorSchema,
  failureMode: "return",
})
  .annotate(Tool.Title, "Search Tavily")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const searchDualTool = Tool.make("search_dual", {
  description: "Run Grok and Tavily concurrently with the CLI's dual-search orchestration.",
  parameters: SearchDualParametersSchema,
  success: DualSearchResultSchema,
  failure: RenderedErrorSchema,
  failureMode: "return",
})
  .annotate(Tool.Title, "Search Dual")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const fetchTool = Tool.make("fetch", {
  description: "Fetch a page with Tavily-first and FireCrawl fallback, matching the CLI.",
  parameters: FetchParametersSchema,
  success: WebFetchResultSchema,
  failure: RenderedErrorSchema,
  failureMode: "return",
})
  .annotate(Tool.Title, "Fetch")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

const mapTool = Tool.make("map", {
  description: "Map a site's reachable URLs with Tavily, matching the CLI.",
  parameters: MapParametersSchema,
  success: TavilyMapResponseSchema,
  failure: RenderedErrorSchema,
  failureMode: "return",
})
  .annotate(Tool.Title, "Map")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true);

export const readOnlyMcpToolkit = Toolkit.make(
  searchGrokTool,
  searchTavilyTool,
  searchDualTool,
  fetchTool,
  mapTool,
);

export const readOnlyMcpToolNames = [
  "search_grok",
  "search_tavily",
  "search_dual",
  "fetch",
  "map",
] as const;

const readOnlyMcpToolkitLayer = readOnlyMcpToolkit.toLayer(
  Effect.gen(function* () {
    const grokSearch = yield* GrokSearch;
    const tavilySearch = yield* TavilySearch;
    const dualSearch = yield* DualSearch;
    const webFetch = yield* WebFetch;
    const tavilyMap = yield* TavilyMap;

    return readOnlyMcpToolkit.of({
      search_grok: Effect.fn("ReadOnlyMcp.searchGrok")(function* (input) {
        const request = yield* GrokSearchInput.decodeEffect({
          query: input.query,
          platform: toOption(input.platform),
          model: toOption(input.model),
        }).pipe(Effect.orDie);

        return yield* grokSearch.search(request).pipe(Effect.mapError(renderStructuredError));
      }),
      search_tavily: Effect.fn("ReadOnlyMcp.searchTavily")(function* (input) {
        const request = yield* TavilySearchInput.decodeEffect({
          query: input.query,
          searchDepth: toOption(input.depth),
          topic: toOption(input.topic),
          timeRange: toOption(input.timeRange),
          maxResults: toOption(input.maxResults),
          includeAnswer: input.includeAnswer ?? false,
        }).pipe(Effect.orDie);

        return yield* tavilySearch.search(request).pipe(Effect.mapError(renderStructuredError));
      }),
      search_dual: Effect.fn("ReadOnlyMcp.searchDual")(function* (input) {
        const request = yield* DualSearchInput.decodeEffect({
          query: input.query,
          platform: toOption(input.platform),
          model: toOption(input.model),
          searchDepth: toOption(input.depth),
          topic: toOption(input.topic),
          timeRange: toOption(input.timeRange),
          maxResults: toOption(input.maxResults),
          includeAnswer: input.includeAnswer ?? false,
        }).pipe(Effect.orDie);

        return yield* dualSearch.search(request).pipe(Effect.mapError(renderStructuredError));
      }),
      fetch: Effect.fn("ReadOnlyMcp.fetch")(function* (input) {
        const request = yield* WebFetchInput.decodeEffect({
          urls: [input.url],
          depth: input.depth ?? "basic",
          format: input.format ?? "markdown",
        }).pipe(Effect.orDie);

        return yield* webFetch.fetch(request).pipe(
          Effect.flatMap((result) => Schema.decodeUnknownEffect(WebFetchResultSchema)(result)),
          Effect.mapError(renderStructuredError),
        );
      }),
      map: Effect.fn("ReadOnlyMcp.map")(function* (input) {
        const request = yield* TavilyMapInput.decodeEffect({
          url: input.url,
          depth: toOption(input.depth),
          breadth: toOption(input.breadth),
          limit: toOption(input.limit),
          instructions: toOption(input.instructions),
        }).pipe(Effect.orDie);

        return yield* tavilyMap.map(request).pipe(Effect.mapError(renderStructuredError));
      }),
    });
  }),
);

const readOnlyProviderLayer = Layer.mergeAll(
  FirecrawlProviderClient.layer,
  GrokProviderClient.layer,
  TavilyProviderClient.layer,
).pipe(Layer.provideMerge(UltimateSearchConfig.layer));

const grokSearchLayer = GrokSearch.layer.pipe(Layer.provideMerge(readOnlyProviderLayer));

const tavilySearchLayer = TavilySearch.layer.pipe(Layer.provideMerge(readOnlyProviderLayer));

const tavilyMapLayer = TavilyMap.layer.pipe(Layer.provideMerge(readOnlyProviderLayer));

const tavilyExtractLayer = TavilyExtract.layer.pipe(Layer.provideMerge(readOnlyProviderLayer));

const firecrawlFetchLayer = FirecrawlFetch.layer.pipe(Layer.provideMerge(readOnlyProviderLayer));

const webFetchLayer = WebFetch.layer.pipe(
  Layer.provideMerge(firecrawlFetchLayer),
  Layer.provideMerge(tavilyExtractLayer),
);

const dualSearchLayer = DualSearch.layer.pipe(
  Layer.provideMerge(grokSearchLayer),
  Layer.provideMerge(tavilySearchLayer),
);

export const readOnlyMcpServicesLayer = Layer.mergeAll(
  grokSearchLayer,
  tavilySearchLayer,
  dualSearchLayer,
  webFetchLayer,
  tavilyMapLayer,
);

export const readOnlyMcpRegistrationLayer = Layer.effectDiscard(
  McpServer.registerToolkit(readOnlyMcpToolkit),
).pipe(Layer.provideMerge(readOnlyMcpToolkitLayer));
