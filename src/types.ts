export interface Env {
	KARAOKEQ: KVNamespace;
	KARAOKEQ_DB: DurableObjectNamespace;
}

export type Method = 'GET'|'POST'|'PUT'|'DELETE'|'OPTIONS'

export type Dict<T = string> = Record<string, T>

export interface ReqInfo {
  domain: string
  path: string
  method: Method
  body: any
  query?: Dict
}

/** username_sessiontoken */
export type VoteToken = `${string}_${string}`
export type QItem = {id: string; votes: VoteToken[]}
export type Q = QItem[]

/** Session token -> last time they requested something (epochmillis) */
export type RateLimitLookup = Record<string, number>
