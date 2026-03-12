import { Option, Schema } from "effect";
import { Flag } from "effect/unstable/cli";

export const optionalTrimmedTextFlag = (name: string, description: string) =>
  Flag.optional(
    Flag.string(name).pipe(Flag.withSchema(Schema.Trim), Flag.withDescription(description)),
  ).pipe(Flag.map((value) => Option.filter(value, (text) => text.length > 0)));

export const optionalChoiceFlag = <A extends string>(
  name: string,
  choices: ReadonlyArray<A>,
  description: string,
) => Flag.optional(Flag.choice(name, choices).pipe(Flag.withDescription(description)));

export const optionalIntegerFlag = (name: string, description: string) =>
  Flag.optional(Flag.integer(name).pipe(Flag.withDescription(description)));

export const optionalIntegerFlagWithSchema = <A>(
  name: string,
  schema: Schema.Codec<A, number>,
  description: string,
) =>
  Flag.optional(
    Flag.integer(name).pipe(Flag.withSchema(schema), Flag.withDescription(description)),
  );
