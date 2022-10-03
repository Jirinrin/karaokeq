import { handleError, handleResult, parseReqInfo, SimpleResponse } from "./reqUtils";
import { Dict, Env, Method, Q, RateLimitLookup } from "./types";

export class Db implements DurableObject {
  private storage: DurableObjectStorage

  constructor(private state: DurableObjectState, env: Env) {
    this.storage = state.storage
  }

  async fetch(request: Request): Promise<Response> {
		try {
			const reqInfo = await parseReqInfo(request)
      const call = `${reqInfo.method}_${reqInfo.path}` as keyof DbHandler
      const result = await this.handleCall(call, reqInfo.domain, reqInfo.method === 'GET' ? reqInfo.query : reqInfo.body, reqInfo.query)

			return handleResult(result)
		} catch (err) {
			return handleError(err)
		}
  }

  private async handleCall<T extends keyof DbHandler>(call: T, domain: string, body: any, query?: Dict<any>) {
    const handler = new DbHandler(this.storage, domain)
    if (!handler[call])
      throw new SimpleResponse("Unknown method/path :(", 404)

    return (handler[call] as any)(body, query) as Awaited<ReturnType<DbHandler[T]>>
  }
}

export class DbHandler {
  private get qKey(): string { return `q_${this.domain}` }
  private get rKey(): string { return `r_${this.domain}` }

  constructor(private storage: DurableObjectStorage, private domain: string) {}

  async GET_q(): Promise<Q> {
    const q = await this.storage.get<Q>(this.qKey, {}) // todo: JSON.parse?
    if (!q)
      throw new SimpleResponse("Queue not found", 404)
    return q
  }
  async PUT_q(q: Q) {
    await this.storage.put(this.qKey, q)
  }
  async DELETE_q() {
    await this.storage.delete(this.qKey)
  }

  async GET_ratelimit(q: {sessionToken: string}): Promise<number> {
    return (await this.storage.get<RateLimitLookup>(this.rKey) ?? {})[q.sessionToken]
  }
  async PUT_ratelimit(_body: null, q: {sessionToken: string, now: number}) {
    const lookup = await this.storage.get<RateLimitLookup>(this.rKey) ?? {}
    lookup[q.sessionToken] = q.now
    await this.storage.put(this.rKey, lookup)
  }
}

type MethodNameForCall<T extends `${Method}_${string}`> = T extends `${infer M extends Method}_${string}` ? M : never

type InterfaceCheck = {
  [K in keyof DbHandler as K extends `${Method}_${string}` ? K : `!!!${K}`]: Parameters<DbHandler[K]> extends (MethodNameForCall<K> extends 'GET' ? [query?: Dict<any>] : [body?: any, query?: Dict<any>]) ? true : false
}
const _: InterfaceCheck extends Record<keyof DbHandler, true> ? true : false = true
