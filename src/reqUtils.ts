import { Dict, Method, PathParamsDict, ReqInfo } from "./types";

export class SimpleResponse extends Response {
  constructor(public message: string, status: number = 200, init: ResponseInit|Response = {}) {
    super(message, {status, ...init})
  }
  
  withHeaders(headers: Dict): SimpleResponse {
    return new SimpleResponse(this.message, this.status, {headers: {...this.headers, ...headers}})
  }
}

export async function parseReqInfoWithParams<P extends `/${string}`>(request: Request, pathPattern: P): Promise<ReqInfo<PathParamsDict<P>>> {
  const reqInfo = await parseReqInfo(request)
  const patternPathParts = pathPattern.slice(1).split(/\//g)
  const pathParts = reqInfo.path.split(/\//g)
  const paramsLookup = {} as Dict
  patternPathParts.forEach((p, i) => {
    const paramName = p.match(/:(\w+)/)?.[1]
    if (paramName)
      paramsLookup[paramName] = pathParts[i]
  })

  return { ...reqInfo, pathParams: paramsLookup as PathParamsDict<P> }
}

export async function parseReqInfo(req: Request): Promise<ReqInfo> {
  const url = new URL(req.url)
  const method = req.method as Method
  const body = (req.headers.get('content-type') || (req.headers.get('content-length') ?? 0) > 0) && method !== 'OPTIONS' ? await req.json() : undefined
  return {
    path: url.pathname.slice(1),
    pathParams: {},
    method,
    body,
    query: url.search ? Object.fromEntries([...url.searchParams.entries()]) : undefined
  }
}

export function handleResult(result: any, corsHeaders: Dict = {}): Response {
  const resultStr: string|null|undefined = result !== undefined && result !== null && typeof result !== 'string' ? JSON.stringify(result) : result
  return new Response(resultStr, {headers: {...corsHeaders}})
}

export function handleError(err: unknown, corsHeaders: Dict = {}): Response {
  if (err instanceof SimpleResponse) {
    console.warn('Expected error', err.message)
    // todo: it seems as if at this point err.text() or err.json() etc. has already been used? Maybe for the instanceof assessment...?
    return err.withHeaders(corsHeaders)
  } else {
    console.error('Internal error', err)
    return new SimpleResponse(`${err}`, 500, {headers: corsHeaders})
  }
}
