import { DurableBServer } from "./DurableB";
import { Env, Method, Q, RateLimitLookup } from "./types";

export type DbParams = {domain: string}

export class Db implements DurableObject {
  private server: DurableBServer<DbHandler>

  constructor(state: DurableObjectState, env: Env) {
    this.server = new DurableBServer<DbHandler>(state.storage, DbHandler)
  }

  async fetch(request: Request): Promise<Response> {
    return this.server.handleRequest(request)
  }
}

export class DbHandler {
  private get qKey(): string { return `q_${this.params.domain}` }
  private get rKey(): string { return `r_${this.params.domain}` }

  constructor(private storage: DurableObjectStorage, public params: {domain: string}) {}

  async getQ(): Promise<Q|undefined> {
    return await this.storage.get<Q>(this.qKey, {})
  }
  async putQ(q: Q) {
    await this.storage.put(this.qKey, q)
  }
  async deleteQ() {
    await this.storage.delete(this.qKey)
  }

  async getRatelimit(sessionToken: string): Promise<number> {
    return (await this.storage.get<RateLimitLookup>(this.rKey) ?? {})[sessionToken]
  }
  async putRatelimit(sessionToken: string, now: number) {
    const lookup = await this.storage.get<RateLimitLookup>(this.rKey) ?? {}
    lookup[sessionToken] = now
    await this.storage.put(this.rKey, lookup)
  }
}

// todo: integrate these checks somewhere more generally? (i.e. in DurableB)
type MethodNameForCall<T extends `${Lowercase<Method>}${string}`> = T extends `${infer M extends Method}_${string}` ? M : never
type InterfaceCheck = {
  [K in keyof DbHandler as K extends `${Lowercase<Method>}${string}` ? K : DbHandler[K] extends Function ? `!!!${K}` : K]: true
}
const _: InterfaceCheck extends Record<keyof DbHandler, true> ? true : false = true
