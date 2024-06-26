export interface Env {
	KARAOKEQ: KVNamespace;
	KARAOKEQ_DB: DurableObjectNamespace;
}

export const validMethods = ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] as const
export type Method = typeof validMethods[number]

export type Dict<T = string> = Record<string, T>

type PathParams<T extends string> = T extends `${string}:${infer R}` ? R extends `${infer P}/${infer S}` ? P | PathParams<S> : R : never
export type PathParamsDict<T extends string> = Record<PathParams<T>, string>

export interface ReqInfo<PP extends Dict = {}> {
  _req: Request
  pathParams: PP
  path: string
  method: Method
  body: any
  query?: Dict
}

export type SongListItem = {
  /** Artist : Title */
  id: string
  /** language */
  l?: string
  /** comment */
  c?: string
  /** source */
  src?: string
}
/** folder structure */
export type SongList = Record<string, SongListItem[]>

/** username_sessiontoken */
export type VoteToken = `${string}_${string}`
export type QItem = {id: string; requestedAt: number; waitingVotes: number; votes: VoteToken[]}
export type Q = QItem[]

/** Session token -> last time they requested something (epochmillis) */
export type RateLimitLookup = Record<string, number>

// todo: actually implement the songlist property
export type Config = { requestRateLimitMins: number, waitingVoteBonus: number, songlist?: SongList }