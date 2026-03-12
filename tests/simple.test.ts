import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";

it.layer(Layer.empty)((it) => {
  it.effect("simple", () =>
    Effect.gen(function* () {
      yield* Effect.log("hi");
    }),
  );
});
