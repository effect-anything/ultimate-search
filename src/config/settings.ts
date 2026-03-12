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

export interface FirecrawlProviderConfig {
  readonly apiUrl: string;
  readonly apiKey: string;
}

export class UltimateSearchConfig extends ServiceMap.Service<
  UltimateSearchConfig,
  {
    readonly settings: UltimateSearchSettings;
    readonly getGrokConfig: () => Effect.Effect<GrokProviderConfig, UltimateSearchError>;
    readonly getTavilyConfig: () => Effect.Effect<TavilyProviderConfig, UltimateSearchError>;
    readonly getFirecrawlConfig: () => Effect.Effect<FirecrawlProviderConfig, UltimateSearchError>;
  }
>()("UltimateSearchConfig") {
  static readonly layer = Layer.effect(
    UltimateSearchConfig,
    Effect.gen(function* () {
      const settings: UltimateSearchConfig.Methods["settings"] = yield* loadSettings.pipe(
        Effect.withSpan("UltimateSearchConfig.settings"),
      );

      const getGrokConfig: UltimateSearchConfig.Methods["getGrokConfig"] = Effect.fn(
        "UltimateSearchConfig.getGrokConfig",
      )(function* (): Effect.fn.Return<GrokProviderConfig, ConfigValidationError, never> {
        const grok = yield* strictConfigEffect(grokEnvironmentConfig);
        const details: Array<string> = [];

        if (Option.isNone(grok.apiUrl)) {
          details.push("Set GROK_API_URL to the grok base URL.");
        }

        if (Option.isNone(grok.apiKey)) {
          details.push("Set GROK_API_KEY to the grok bearer token.");
        }

        if (details.length > 0) {
          return yield* new ConfigValidationError({
            provider: "grok",
            message: "Missing required Grok configuration.",
            details,
          });
        }

        return {
          apiUrl: Option.getOrElse(grok.apiUrl, () => ""),
          apiKey: Option.getOrElse(grok.apiKey, () => ""),
          model: grok.model,
        } satisfies GrokProviderConfig;
      });

      const getTavilyConfig: UltimateSearchConfig.Methods["getTavilyConfig"] = Effect.fn(
        "UltimateSearchConfig.getTavilyConfig",
      )(function* (): Effect.fn.Return<TavilyProviderConfig, ConfigValidationError, never> {
        const tavily = yield* strictConfigEffect(tavilyEnvironmentConfig);
        const details: Array<string> = [];

        if (Option.isNone(tavily.apiUrl)) {
          details.push("Set TAVILY_API_URL to the Tavily or Tavily proxy base URL.");
        }

        if (Option.isNone(tavily.apiKey)) {
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
          apiUrl: Option.getOrElse(tavily.apiUrl, () => ""),
          apiKey: Option.getOrElse(tavily.apiKey, () => ""),
        } satisfies TavilyProviderConfig;
      });

      const getFirecrawlConfig: UltimateSearchConfig.Methods["getFirecrawlConfig"] = Effect.fn(
        "UltimateSearchConfig.getFirecrawlConfig",
      )(function* (): Effect.fn.Return<FirecrawlProviderConfig, ConfigValidationError, never> {
        const firecrawl = yield* strictConfigEffect(firecrawlEnvironmentConfig);

        if (Option.isNone(firecrawl.apiKey)) {
          return yield* new ConfigValidationError({
            provider: "firecrawl",
            message: "Missing required FireCrawl configuration.",
            details: ["Set FIRECRAWL_API_KEY to the FireCrawl bearer token."],
          });
        }

        return {
          apiUrl: firecrawl.apiUrl,
          apiKey: Option.getOrElse(firecrawl.apiKey, () => ""),
        } satisfies FirecrawlProviderConfig;
      });

      return UltimateSearchConfig.of({
        settings,
        getGrokConfig,
        getTavilyConfig,
        getFirecrawlConfig,
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

const grokEnvironmentConfig = Config.all({
  apiUrl: optionalUrlConfig("GROK_API_URL"),
  apiKey: optionalSecretConfig("GROK_API_KEY"),
  model: requiredTextConfig("GROK_MODEL", "grok-4.1-fast"),
}) satisfies Config.Config<GrokEnvironment>;

const tavilyEnvironmentConfig = Config.all({
  apiUrl: optionalUrlConfig("TAVILY_API_URL"),
  apiKey: optionalSecretConfig("TAVILY_API_KEY"),
}) satisfies Config.Config<ProviderEnvironment>;

const firecrawlEnvironmentConfig = Config.all({
  apiUrl: requiredUrlConfig("FIRECRAWL_API_URL", "https://api.firecrawl.dev/v2"),
  apiKey: optionalSecretConfig("FIRECRAWL_API_KEY"),
}) satisfies Config.Config<FirecrawlEnvironment>;

const defaultGrokEnvironment: GrokEnvironment = {
  apiUrl: Option.none(),
  apiKey: Option.none(),
  model: "grok-4.1-fast",
};

const defaultTavilyEnvironment: ProviderEnvironment = {
  apiUrl: Option.none(),
  apiKey: Option.none(),
};

const defaultFirecrawlEnvironment: FirecrawlEnvironment = {
  apiUrl: "https://api.firecrawl.dev/v2",
  apiKey: Option.none(),
};

const mapConfigLoadError = (error: unknown) =>
  new ConfigValidationError({
    provider: "shared",
    message: "Failed to load CLI configuration.",
    details: configErrorDetails(error),
    cause: error,
  });

const strictConfigEffect = <A>(config: Config.Config<A>) =>
  config
    .asEffect()
    .pipe(Effect.mapError(mapConfigLoadError), Effect.withSpan("UltimateSearchConfig.settings"));

const bestEffortConfigEffect = <A>(config: Config.Config<A>, fallback: A) =>
  strictConfigEffect(config).pipe(Effect.catch(() => Effect.succeed(fallback)));

const loadSettings = Effect.all({
  grok: bestEffortConfigEffect(grokEnvironmentConfig, defaultGrokEnvironment),
  tavily: bestEffortConfigEffect(tavilyEnvironmentConfig, defaultTavilyEnvironment),
  firecrawl: bestEffortConfigEffect(firecrawlEnvironmentConfig, defaultFirecrawlEnvironment),
}) satisfies Effect.Effect<UltimateSearchSettings, never, never>;

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
