export interface Env {
	KARAOKEQ: KVNamespace;
}

export type Method = 'GET'|'POST'|'PUT'|'DELETE'|'OPTIONS'

export type VoteToken = `${string}_${string}` // username_sessiontoken
export type QItem = {id: string; votes: VoteToken[]}
export type Q = QItem[]
