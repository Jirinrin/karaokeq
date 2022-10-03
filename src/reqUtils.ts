import { Dict, Method, ReqInfo } from "./types";

export class SimpleResponse extends Response {
  constructor(public message: string, status: number = 200, init: ResponseInit|Response = {}) {
    super(message, {status, ...init})
  }
  
  withHeaders(headers: Dict): SimpleResponse {
    return new SimpleResponse(this.message, this.status, {headers: {...this.headers, ...headers}})
  }
}

export async function parseReqInfo(request: Request): Promise<ReqInfo> {
  const url = new URL(request.url)
  const [match, domain, path, q] = url.pathname.match(/\/([^\/]+)\/([^\/]+)(?:\?([^?]+))?/) ?? []
  if (!match)
    throw new SimpleResponse('Invalid request: path must look like e.g. /:domain/:path', 400)

  const method = request.method as Method
  const body = request.body && method !== 'OPTIONS' ? await request.json() : undefined
  return {
    domain,
    path,
    method,
    body,
    query: q && Object.fromEntries(q.split('&').map(term => term.split('=')))
  }
}

export function handleResult(result: any, corsHeaders: Dict = {}): Response {
  const resultStr: string = typeof result === 'object' ? JSON.stringify(result) : result && `${result}`
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
