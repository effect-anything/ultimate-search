import { Data } from "effect";

export type SearchProvider = "shared" | "grok" | "tavily" | "firecrawl";

export class ConfigValidationError extends Data.TaggedError(
  "ConfigValidationError",
)<{
  readonly provider: SearchProvider;
  readonly message: string;
  readonly details: ReadonlyArray<string>;
}> {}

export class ProviderRequestError extends Data.TaggedError(
  "ProviderRequestError",
)<{
  readonly provider: SearchProvider;
  readonly message: string;
}> {}

export class ProviderResponseError extends Data.TaggedError(
  "ProviderResponseError",
)<{
  readonly provider: SearchProvider;
  readonly message: string;
  readonly status: number;
  readonly body: string;
}> {}

export class ProviderDecodeError extends Data.TaggedError(
  "ProviderDecodeError",
)<{
  readonly provider: SearchProvider;
  readonly message: string;
}> {}

export type UltimateSearchError =
  | ConfigValidationError
  | ProviderRequestError
  | ProviderResponseError
  | ProviderDecodeError;
