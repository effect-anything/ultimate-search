import { Effect, Option, Schema, SchemaIssue, SchemaTransformation } from "effect";

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/u, "");

export const trimmedNonEmptyStringSchema = (message: string) =>
  Schema.Trim.pipe(Schema.decodeTo(Schema.NonEmptyString), Schema.annotate({ message }));

export const optionalTrimmedNonEmptyStringFromStringSchema = Schema.Trim.pipe(
  Schema.decodeTo(
    Schema.Option(Schema.NonEmptyString),
    SchemaTransformation.transform({
      decode: (value) => (value.length === 0 ? Option.none<string>() : Option.some(value)),
      encode: (value) => Option.getOrElse(value, () => ""),
    }),
  ),
);

export const absoluteUrlStringSchema = (message: string) =>
  Schema.Trim.pipe(
    Schema.decodeTo(
      Schema.String,
      SchemaTransformation.transformOrFail({
        decode: (value) =>
          Effect.try({
            try: () => stripTrailingSlashes(new URL(value).toString()),
            catch: () => new SchemaIssue.InvalidValue(Option.some(value), { message }),
          }),
        encode: (value) => Effect.succeed(value),
      }),
    ),
  );

export const optionalAbsoluteUrlStringFromStringSchema = (message: string) =>
  Schema.Trim.pipe(
    Schema.decodeTo(
      Schema.Option(absoluteUrlStringSchema(message)),
      SchemaTransformation.transform({
        decode: (value) => (value.length === 0 ? Option.none<string>() : Option.some(value)),
        encode: (value) => Option.getOrElse(value, () => ""),
      }),
    ),
  );
