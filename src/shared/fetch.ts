import { Layer, ServiceMap } from "effect";
import type { ServicesReturns } from "./effect";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class FetchService extends ServiceMap.Service<
  FetchService,
  {
    readonly fetch: FetchLike;
  }
>()("FetchService") {
  static readonly fetch: FetchService.Methods["fetch"] = globalThis.fetch.bind(globalThis);

  static readonly layer = Layer.succeed(
    this,
    this.of({
      fetch: this.fetch,
    }),
  );
}

export declare namespace FetchService {
  export type Methods = ServiceMap.Service.Shape<typeof FetchService>;
  export type Returns<key extends keyof Methods, R = never> = ServicesReturns<Methods[key], R>;
}
