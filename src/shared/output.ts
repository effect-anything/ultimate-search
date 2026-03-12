import { writeStderr, writeStdout } from "../cli/io";
import {
  ConfigValidationError,
  ProviderDecodeError,
  ProviderRequestError,
  ProviderResponseError,
} from "./errors";

const stringify = (value: unknown) => JSON.stringify(value, null, 2);

const renderError = (error: unknown) => {
  if (error instanceof ConfigValidationError) {
    return {
      type: error._tag,
      provider: error.provider,
      message: error.message,
      details: error.details,
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

export const writeJsonStdout = (value: unknown) => writeStdout(stringify(value));

export const writeRenderedError = (error: unknown) =>
  writeStderr(stringify({ error: renderError(error) }));
