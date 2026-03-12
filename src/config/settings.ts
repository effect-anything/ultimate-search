import { Config, Effect, Layer, Option, ServiceMap } from "effect";
import { ConfigValidationError, type UltimateSearchError } from "../shared/errors";
import type { ServicesReturns } from "../shared/effect";
import {
  optionalAbsoluteUrlStringFromStringSchema,
  optionalTrimmedNonEmptyStringFromStringSchema,
} from "../shared/schema";

export interface ProviderEnvironment {
  readonly apiUrl: Option.Option<string>;
  readonly apiKey: Option.Option<string>;
}

export interface GrokEnvironment extends ProviderEnvironment {
  readonly model: string;
}

export interface FirecrawlEnvironment {
  readonly apiUrl: string;
  readonly apiKey: Option.Option<string>;
}

export interface UltimateSearchSettings {
  readonly grok: GrokEnvironment;
  readonly tavily: ProviderEnvironment;
  readonly firecrawl: FirecrawlEnvironment;
}

export interface GrokProviderConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export interface TavilyProviderConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
}

export class UltimateSearchConfig extends ServiceMap.Service<
  UltimateSearchConfig,
  {
    readonly settings: UltimateSearchSettings;
    readonly getGrokConfig: () => Effect.Effect<GrokProviderConfig, UltimateSearchError>;
    readonly getTavilyConfig: () => Effect.Effect<TavilyProviderConfig, UltimateSearchError>;
  }
>()("UltimateSearchConfig") {
  static readonly layer = Layer.effect(
    UltimateSearchConfig,
    Effect.gen(function* () {
      const settings: UltimateSearchConfig.Methods["settings"] = yield* settingsConfig
        .asEffect()
        .pipe(
          Effect.mapError(
            (error) => {
              const details = configErrorDetails(error);

              return new ConfigValidationError({
                provider: "shared",
                message: "Failed to load CLI configuration.",
                ...(details.length > 0 ? { details } : {}),
                cause: error,
              });
            },
          ),
          Effect.withSpan("UltimateSearchConfig.settings"),
        );

      const getGrokConfig: UltimateSearchConfig.Methods["getGrokConfig"] = Effect.fn(
        "UltimateSearchConfig.getGrokConfig",
      )(function* (): Effect.fn.Return<GrokProviderConfig, ConfigValidationError, never> {
        const details: Array<string> = [];

        if (Option.isNone(settings.grok.apiUrl)) {
          details.push("Set GROK_API_URL to the grok2api base URL.");
        }

        if (Option.isNone(settings.grok.apiKey)) {
          details.push("Set GROK_API_KEY to the grok2api bearer token.");
        }

        if (details.length > 0) {
          return yield* new ConfigValidationError({
            provider: "grok",
            message: "Missing required Grok configuration.",
            details,
          });
        }

        return {
          apiUrl: Option.getOrElse(settings.grok.apiUrl, () => ""),
          apiKey: Option.getOrElse(settings.grok.apiKey, () => ""),
          model: settings.grok.model,
        } satisfies GrokProviderConfig;
      });

      const getTavilyConfig: UltimateSearchConfig.Methods["getTavilyConfig"] = Effect.fn(
        "UltimateSearchConfig.getTavilyConfig",
      )(function* (): Effect.fn.Return<TavilyProviderConfig, ConfigValidationError, never> {
        const details: Array<string> = [];

        if (Option.isNone(settings.tavily.apiUrl)) {
          details.push("Set TAVILY_API_URL to the Tavily or Tavily proxy base URL.");
        }

        if (Option.isNone(settings.tavily.apiKey)) {
          details.push("Set TAVILY_API_KEY to the Tavily or Tavily proxy bearer token.");
        }

        if (details.length > 0) {
          return yield* new ConfigValidationError({
            provider: "tavily",
            message: "Missing required Tavily configuration.",
            details,
          });
        }

        return {
          apiUrl: Option.getOrElse(settings.tavily.apiUrl, () => ""),
          apiKey: Option.getOrElse(settings.tavily.apiKey, () => ""),
        } satisfies TavilyProviderConfig;
      });

      return UltimateSearchConfig.of({
        settings,
        getGrokConfig,
        getTavilyConfig,
      });
    }),
  );
}

export declare namespace UltimateSearchConfig {
  export type Methods = ServiceMap.Service.Shape<typeof UltimateSearchConfig>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}

const optionalUrlConfig = (name: string) =>
  Config.schema(
    optionalAbsoluteUrlStringFromStringSchema(`${name} must be an absolute URL.`),
    name,
  ).pipe(Config.withDefault(Option.none<string>()));

const optionalSecretConfig = (name: string) =>
  Config.schema(optionalTrimmedNonEmptyStringFromStringSchema, name).pipe(
    Config.withDefault(Option.none<string>()),
  );

const requiredTextConfig = (name: string, fallback: string) =>
  Config.schema(optionalTrimmedNonEmptyStringFromStringSchema, name).pipe(
    Config.withDefault(Option.none<string>()),
    Config.map(Option.getOrElse(() => fallback)),
  );

const requiredUrlConfig = (name: string, fallback: string) =>
  Config.schema(
    optionalAbsoluteUrlStringFromStringSchema(`${name} must be an absolute URL.`),
    name,
  ).pipe(Config.withDefault(Option.none<string>()), Config.map(Option.getOrElse(() => fallback)));

const settingsConfig = Config.all({
  grok: Config.all({
    apiUrl: optionalUrlConfig("GROK_API_URL"),
    apiKey: optionalSecretConfig("GROK_API_KEY"),
    model: requiredTextConfig("GROK_MODEL", "grok-4.1-fast"),
  }),
  tavily: Config.all({
    apiUrl: optionalUrlConfig("TAVILY_API_URL"),
    apiKey: optionalSecretConfig("TAVILY_API_KEY"),
  }),
  firecrawl: Config.all({
    apiUrl: requiredUrlConfig("FIRECRAWL_API_URL", "https://api.firecrawl.dev/v2"),
    apiKey: optionalSecretConfig("FIRECRAWL_API_KEY"),
  }),
}) satisfies Config.Config<UltimateSearchSettings>;

const configErrorDetails = (error: unknown): Array<string> => {
  if (error instanceof Config.ConfigError && error.message.length > 0) {
    return [error.message];
  }

  if (error instanceof Error && error.message.length > 0) {
    return [error.message];
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return [error.message];
  }

  if (typeof error === "string" && error.length > 0) {
    return [error];
  }

  if (error != null) {
    const text = String(error);

    if (text.length > 0 && text !== "[object Object]") {
      return [text];
    }
  }

  return [];
};
