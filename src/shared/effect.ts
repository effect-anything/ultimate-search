import { Effect } from "effect";
/**
 * Derives the return type for a service method, strictly preserving the
 * method's full type signature (success, error, and context).
 *
 * Unlike RPC return helpers (where transport contracts typically do not carry a
 * context channel and `R` is introduced separately), service interfaces already
 * define the full `Effect.Effect<A, E, R>` — including dependencies. The
 * implementation must conform exactly; any extra dependency is a compile error,
 * not something to patch in via a generic.
 *
 * @typeParam T - The service method type (from `ServiceMap.Service.Shape<typeof MyService>[key]`)
 * @typeParam R - Optional additional context requirements to merge with the method's context
 *
 * @example
 * ```ts
 * import { Effect, ServiceMap } from "effect"
 *
 * export class MyService extends ServiceMap.Service<MyService, {
 *   readonly list: () => Effect.Effect<Items, MyError>
 *   readonly data: Effect.Effect<Data, MyError>
 * }>()("MyService") {}
 *
 * export declare namespace MyService {
 *   export type Methods = ServiceMap.Service.Shape<typeof MyService>
 *   export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>
 * }
 *
 * const list: MyService.Methods['list'] = Effect.fn('list')(
 *   function* (): MyService.Returns<'list'> {
 *     // return type is locked to Effect.Effect<Items, MyError, never>
 *     ...
 *   }
 * )
 *
 * // With additional context
 * const listWithLogger: MyService.Methods['list'] = Effect.fn('list')(
 *   function* (): MyService.Returns<'list', Logger> {
 *     // return type is Effect.Effect<Items, MyError, Logger>
 *     const logger = yield* Logger
 *     ...
 *   }
 * )
 * ```
 */
export type ServicesReturns<T, R = never> = T extends (
  ...args: any
) => Effect.Effect<infer A, infer E, infer R0>
  ? Effect.fn.Return<A, E, R0 | R>
  : T extends Effect.Effect<infer A, infer E, infer R0>
    ? Effect.fn.Return<A, E, R0 | R>
    : T;
