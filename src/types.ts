export interface Env {
	KARAOKEQ: KVNamespace;
}

export type Method = 'GET'|'POST'|'PUT'|'DELETE'|'OPTIONS'

/** username_sessiontoken */
export type VoteToken = `${string}_${string}`
export type QItem = {id: string; votes: VoteToken[]}
export type Q = QItem[]

/** Session token -> last time they requested something (epochmillis) */
export type RateLimitLookup = Record<string, number>
