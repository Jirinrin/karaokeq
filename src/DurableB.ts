import { handleError, handleResult, hasContentLength, parseReqInfo, SimpleResponse } from "./reqUtils";
import { Dict } from "./types";

type Methods<T> = {[K in keyof T as T[K] extends (...args: any) => any ? K : never]: T[K]}
type ParametersLenient<T> = T extends (...args: infer P) => any ? P : never;
type ReturnTypeLenient<T> = T extends (...args: any) => infer R ? R : any;

type DurableBHandler<T extends Dict = any> = {params?: T}

export class DurableBClient<T extends DurableBHandler, M = Methods<T>> {
  constructor(private stub: DurableObjectStub, private baseUrl: string, private params: T['params']) {}

  public async call<K extends keyof M>(call: K, ...args: ParametersLenient<M[K]>) {
    const q = this.params ? '?' + Object.entries(this.params).map(([k,v]) => `${k}=${v}`).join('&') : ''
    const body = args.length ? JSON.stringify(args) : undefined
    const resp = await this.stub.fetch(`${this.baseUrl}/${String(call)}${q}`, {
      method: 'POST', // todo: okay so it's now just always POST for ease sake, but i sure hope this doesn't make 'get' calls count towards class A requests...
      body,
      headers: { ...(body ? {'content-type': 'application/json'} : {}) } as Dict
    })
    if (!resp.ok) {
      throw new SimpleResponse(await resp.text(), resp.status)
    }
    return (resp.headers.get('content-type') || hasContentLength(resp) ? resp.json() : null) as Awaited<ReturnTypeLenient<M[K]>>
  }
}

export function makeClientProxy<T extends DurableBHandler>(client: DurableBClient<T>): T {
  return new Proxy(client, {
    get(target, key) {
      return (...args: any[]) => ((target as DurableBClient<T>).call as any)(key, ...args)
    }
  }) as unknown as T
}

export class DurableBServer<T extends DurableBHandler> {
  constructor(private storage: DurableObjectStorage, private Handler: new (storage: DurableObjectStorage, params: T['params']) => T) {}

  public async handleRequest(request: Request): Promise<Response> {
		try {
      const reqInfo = await parseReqInfo(request)
      const result = await this.handleCall(reqInfo.path as keyof T & string, reqInfo.query, reqInfo.body)
			return handleResult(result)
		} catch (err) {
			return handleError(err)
		}
  }

  private async handleCall<K extends keyof T & string>(call: K, params: T['params'], body: any) {
    const handler = new this.Handler(this.storage, params)
    if (typeof handler[call] !== 'function')
      throw new SimpleResponse("DurableBServer called with unknown method/path :(", 404)

    return await (handler as any)[call](...(body ?? [])) as Awaited<T extends (...args: any) => infer R ? R : never>
  }
}