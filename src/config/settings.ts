import { Config, Effect, Option, ServiceMap } from "effect";
import { ConfigValidationError, type UltimateSearchError } from "../shared/errors.ts";

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

export interface UltimateSearchConfigService {
  readonly settings: UltimateSearchSettings;
  readonly grok: Effect.Effect<GrokProviderConfig, UltimateSearchError>;
}

export const UltimateSearchConfig =
  ServiceMap.Service<UltimateSearchConfigService>("UltimateSearchConfig");

const normalizeOptional = (value: string) => {
  const trimmed = value.trim();

  return trimmed.length === 0
    ? Option.none<string>()
    : Option.some(trimmed.replace(/\/+$/u, ""));
};

const normalizeOptionalSecret = (value: string) => {
  const trimmed = value.trim();

  return trimmed.length === 0 ? Option.none<string>() : Option.some(trimmed);
};

const normalizeDefaultString = (value: string, fallback: string) => {
  const trimmed = value.trim();

  return trimmed.length === 0 ? fallback : trimmed;
};

const optionalUrlConfig = (name: string) =>
  Config.string(name).pipe(
    Config.withDefault(""),
    Config.map(normalizeOptional),
  );

const optionalSecretConfig = (name: string) =>
  Config.string(name).pipe(
    Config.withDefault(""),
    Config.map(normalizeOptionalSecret),
  );

const settingsConfig = Config.all({
  grokApiUrl: optionalUrlConfig("GROK_API_URL"),
  grokApiKey: optionalSecretConfig("GROK_API_KEY"),
  grokModel: Config.string("GROK_MODEL").pipe(
    Config.withDefault("grok-4.1-fast"),
    Config.map((value) => normalizeDefaultString(value, "grok-4.1-fast")),
  ),
  tavilyApiUrl: optionalUrlConfig("TAVILY_API_URL"),
  tavilyApiKey: optionalSecretConfig("TAVILY_API_KEY"),
  firecrawlApiUrl: Config.string("FIRECRAWL_API_URL").pipe(
    Config.withDefault("https://api.firecrawl.dev/v2"),
    Config.map((value) =>
      normalizeDefaultString(value, "https://api.firecrawl.dev/v2").replace(
        /\/+$/u,
        "",
      )),
  ),
  firecrawlApiKey: optionalSecretConfig("FIRECRAWL_API_KEY"),
});

const configLoadError = (message: string, details: ReadonlyArray<string>) =>
  new ConfigValidationError({
    provider: "shared",
    message,
    details: [...details],
  });

const resolveAbsoluteUrl = (
  envName: string,
  rawUrl: string,
): Effect.Effect<string, ConfigValidationError> =>
  Effect.try({
    try: () => new URL(rawUrl).toString().replace(/\/+$/u, ""),
    catch: () =>
      configLoadError(`Invalid ${envName} value.`, [
        `${envName} must be an absolute URL.`,
      ]),
  });

const loadSettings = Effect.gen(function* () {
  const config = yield* settingsConfig;

  return {
    grok: {
      apiUrl: config.grokApiUrl,
      apiKey: config.grokApiKey,
      model: config.grokModel,
    },
    tavily: {
      apiUrl: config.tavilyApiUrl,
      apiKey: config.tavilyApiKey,
    },
    firecrawl: {
      apiUrl: config.firecrawlApiUrl,
      apiKey: config.firecrawlApiKey,
    },
  } satisfies UltimateSearchSettings;
}).pipe(
  Effect.mapError((error) =>
    configLoadError("Failed to load CLI configuration.", [error.message])),
);

const requireGrokConfig = (
  settings: UltimateSearchSettings,
): Effect.Effect<GrokProviderConfig, ConfigValidationError> =>
  Effect.gen(function* () {
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

    const rawApiUrl = Option.match(settings.grok.apiUrl, {
      onNone: () => "",
      onSome: (value) => value,
    });

    const rawApiKey = Option.match(settings.grok.apiKey, {
      onNone: () => "",
      onSome: (value) => value,
    });

    const apiUrl = yield* resolveAbsoluteUrl("GROK_API_URL", rawApiUrl);

    return {
      apiUrl,
      apiKey: rawApiKey,
      model: settings.grok.model,
    } satisfies GrokProviderConfig;
  });

export const UltimateSearchConfigLive = Effect.gen(function* () {
  const settings = yield* loadSettings;

  return UltimateSearchConfig.of({
    settings,
    grok: requireGrokConfig(settings),
  });
});
