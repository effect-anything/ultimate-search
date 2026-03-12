import { ServiceMap } from "effect";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface FetchService {
  readonly fetch: FetchLike;
}

export const FetchService = ServiceMap.Service<FetchService>("FetchService");

export const FetchServiceLive = FetchService.of({
  fetch: globalThis.fetch.bind(globalThis),
});
