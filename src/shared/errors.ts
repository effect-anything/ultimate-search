import { Schema } from "effect";

export const SearchProvider = Schema.Literals(["shared", "grok", "tavily", "firecrawl"]);

export class ConfigValidationError extends Schema.TaggedErrorClass<ConfigValidationError>()(
  "ConfigValidationError",
  {
    provider: SearchProvider,
    message: Schema.String,
    details: Schema.optional(Schema.Array(Schema.String)),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ProviderRequestError extends Schema.TaggedErrorClass<ProviderRequestError>()(
  "ProviderRequestError",
  {
    provider: SearchProvider,
    message: Schema.String,
  },
) {}

export class ProviderResponseError extends Schema.TaggedErrorClass<ProviderResponseError>()(
  "ProviderResponseError",
  {
    provider: SearchProvider,
    message: Schema.String,
    status: Schema.Number,
    body: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export class ProviderDecodeError extends Schema.TaggedErrorClass<ProviderDecodeError>()(
  "ProviderDecodeError",
  {
    provider: SearchProvider,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export type UltimateSearchError =
  | ConfigValidationError
  | ProviderRequestError
  | ProviderResponseError
  | ProviderDecodeError;
