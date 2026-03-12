import { Config } from "effect";
import { Schema } from "effect";
import {
  ConfigValidationError,
  ProviderDecodeError,
  ProviderRequestError,
  ProviderResponseError,
} from "./errors";

export interface RenderedError {
  readonly type: string;
  readonly provider?: string;
  readonly message: string;
  readonly details?: ReadonlyArray<string>;
  readonly status?: number;
  readonly body?: string;
}

export const RenderedErrorSchema = Schema.Struct({
  type: Schema.String,
  provider: Schema.optional(Schema.String),
  message: Schema.String,
  details: Schema.optional(Schema.Array(Schema.String)),
  status: Schema.optional(Schema.Number),
  body: Schema.optional(Schema.String),
});

const configErrorDetails = (error: ConfigValidationError): Array<string> => {
  const details = Array.isArray(error.details)
    ? error.details.filter((detail) => detail.length > 0)
    : [];

  if (details.length > 0) {
    return details;
  }

  if (error.cause instanceof Config.ConfigError && error.cause.message.length > 0) {
    return [error.cause.message];
  }

  if (error.cause instanceof Error && error.cause.message.length > 0) {
    return [error.cause.message];
  }

  if (typeof error.cause === "string" && error.cause.length > 0) {
    return [error.cause];
  }

  return [];
};

export const renderStructuredError = (error: unknown): RenderedError => {
  if (error instanceof ConfigValidationError) {
    const details = configErrorDetails(error);

    return {
      type: error._tag,
      provider: error.provider,
      message: error.message,
      ...(details.length > 0 ? { details } : {}),
    };
  }

  if (error instanceof ProviderRequestError) {
    return {
      type: error._tag,
      provider: error.provider,
      message: error.message,
    };
  }

  if (error instanceof ProviderResponseError) {
    return {
      type: error._tag,
      provider: error.provider,
      message: error.message,
      status: error.status,
      body: error.body,
    };
  }

  if (error instanceof ProviderDecodeError) {
    return {
      type: error._tag,
      provider: error.provider,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
    };
  }

  return {
    type: "UnknownError",
    message: String(error),
  };
};
