import { DbHandler } from './db';
import { DurableBClient, makeClientProxy } from './DurableB';
import { SimpleResponse } from './reqUtils';
import songlist from './songlist.json';
import { Env, Method, Q, QItem, ReqInfo, VoteToken } from "./types";

// todo: possibly store this in kv so it's possible to get (override) a different song list per domain
const availableSongIds = Object.keys(songlist).filter(k => k !== 'unincluded').flatMap(k => songlist[k as keyof typeof songlist]).sort()

const fillSong = 'Rick Astley : Never Gonna Give You Up'
// const fillSong = 'Yumi Kimura : Itsumo Nando Demo'

const keyRequestRateLimitMins = 'requestRateLimitMins'

export default class Handler {
  private kv: KVNamespace;
  private userName: string;
  private adminToken: string|null;
  private sessionToken: string;

  private get aKey(): string { return `a_${this.domain}` }
  private get votingToken(): VoteToken { return `${this.userName}_${this.sessionToken}` }
  private get now() { return Date.now() }

  private _requestRateLimitMins: number|null = null
  private async requestRateLimitMins(): Promise<number> { return this._requestRateLimitMins ??= (await this.kv.get<number>(keyRequestRateLimitMins, {type: 'json', cacheTtl: 300}) ?? 0) }

  private db: DbHandler

  constructor(env: Env, baseUrl: string, private domain: string, userName: string|null, sessionToken: string|null, adminToken: string|null) {
    this.kv = env.KARAOKEQ
    this.userName = userName ?? ''
    this.adminToken = adminToken
    // todo: maybe also expect admin token separately? Or maybe just recommend the user to use a difficult to guess username on the queue creation thing
    this.sessionToken = sessionToken ?? '' // If you manage to not send this header then you're in the same boat as the other who didn't think to send it

    const dbObjId = env.KARAOKEQ_DB.idFromName('karaokeq_db')
    this.db = makeClientProxy(new DurableBClient(env.KARAOKEQ_DB.get(dbObjId), baseUrl, {domain}))
  }

  async handleRequest({method, path, body}: ReqInfo): Promise<any> {
    const is = (m: Method, p: string) => method == m && path == p

    if (is('GET',   'q-simple'))  return this.getSimpleQueue()
    if (is('POST',  'q-simple'))  return this.getUpdatedSimpleQueue(body.currentSongId, body.songIdHistory ?? [])
    if (is('GET',   'q'))         return this.getQueue()
    if (is('POST',  'create'))    return this.createQueue()
    if (is('POST',  'vote'))      return this.voteSong(body.songId)
    if (is('POST',  'request'))   return this.requestSong(body.songId)
    if (is('GET',   'req-rate-limit')) return this.requestRateLimitMins()
    if (method == 'OPTIONS')      return null
    // Admin handlers
    if (is('POST',  'reset'))     return this.adminResetQueue()
    if (is('POST',  'setvotes'))  return this.adminSetVotes(body.songId, body.votes)
    if (is('POST',  'remove'))    return this.adminRemoveSongFromQueue(body.songId)
    if (is('PUT',   'q'))         return this.adminSetQueue(body.q)
    if (is('DELETE','q'))         return this.adminDeleteQueue()
    if (is('POST',  'authorize')) return this.adminAuthorize()
    if (is('PUT',   'req-rate-limit')) return this.adminSetRequestRateLimit(body.minutes)
    // todo: allow a websocket connection to continuously receive updates on the Q, for an admin or sth

		throw new SimpleResponse("Unknown method/path :(", 404)
  }

  async getSimpleQueue(): Promise<string> {
    // Just fill out the list because ultrastar has some glitchy behaviour which causes it to break if there's not at least 10 items in the list
    return (await this.getQ()).map(s => s.id).join('\n') + `\n${fillSong}`.repeat(10)
  }

  async getQueue(): Promise<Q> {
    return this.getQ()
  }

  // async getQueueWS(): Promise<Q> {
  //   // todo: websocket impl so that you constantly get updates? But for now we can just let it poll
  //   return this.getQ()
  // }

  async getUpdatedSimpleQueue(currentSongId: string, songIdHistory: string[]): Promise<string> {
    if (typeof currentSongId != 'string')
      throw new SimpleResponse('No currentSongId specified', 400)

    let q = await this.getQ()
    const currentSongIndex = q.findIndex(s => s.id === currentSongId)
    if (currentSongIndex === -1 && currentSongId !== availableSongIds[0] && currentSongId !== fillSong) {
      // currentSongId not found in queue -> adding it to the front
      q = [{id: currentSongId, votes: ['admin_']}, ...q]
      await this.setQ(q)
    } else if (currentSongIndex > 0) {
      // currentSongId found later in the queue than the first place ->
      // go through the songs before the current song in the queue (this will usually be nothing, but in case a song was played after an internet outage etc.),
      // and remove them from the queue if they have already been played in the last 5 or so songs
      const qCopy = [...q] as (QItem|null)[]
      for (let i = 0; i < currentSongIndex; i++) {
        if (songIdHistory.includes(q[i].id))
          qCopy[i] = null
      }
      q = qCopy.filter((s): s is QItem => !!s)
      // always move current song to front
      q = [{id: currentSongId, votes: ['admin_']}, ...q.filter(s => s.id !== currentSongId)]
      await this.setQ(q)
    }
    // Just fill out the list because ultrastar has some glitchy behaviour which causes it to break if there's not at least 10 items in the list
    return q.map(s => s.id).join('\n') + `\n${fillSong}`.repeat(10)
  }

  async createQueue(initial: Q = []): Promise<Q> {
    if (await this.db.getQ())
      throw new SimpleResponse('Domain already exists', 400)

    if (!this.adminToken)
      throw new SimpleResponse('You need to include the Q-Admin-Token header in your request', 400)

    await this.kv.put(this.aKey, this.adminToken)
    return this.setQ(initial)
  }

  async voteSong(id: string): Promise<Q> {
    const q = await this.getQ()
    const s = await this.getSongInQ(id, q)

    if (s.votes.includes(this.votingToken) && await this.isPeasant)
      throw new SimpleResponse('You already voted on this song', 405)

    return this.setVotes({id, votes: s.votes.concat(this.votingToken)}, q)
  }

  async requestSong(id: string): Promise<Q> {
    this.validateSongAvailable(id)
    
    const q = await this.getQ()
    if (q.find(s => s.id === id))
      throw new SimpleResponse('Song already in queue: ' + id, 400)

    const reqLimitMins = await this.requestRateLimitMins()
    if (reqLimitMins > 0 && !(await this.isAdmin())) {
      const {sessionToken, now} = this
      const lastUpdateBySession = await this.db.getRatelimit(sessionToken)
      if (lastUpdateBySession && now - lastUpdateBySession < (1000*60)*reqLimitMins) {
        if (await this.isPeasant)
          throw new SimpleResponse(`You need to wait ${reqLimitMins} minute${reqLimitMins === 1 ? '' : 's'} in between song requests`, 429)
      }
      await this.db.putRatelimit(sessionToken, now)
    }
    
    return this.setQ([...q, {id, votes: [this.votingToken]}])
  }

  private async verifyIsAdmin(): Promise<boolean> {
    return await this.kv.get(this.aKey, {cacheTtl: 3600}) === this.adminToken
  }
  private get isPeasant(): Promise<boolean> {
    return this.verifyIsAdmin().then(res => !res)
  }

  private adminHandler = <CB extends (...args: any[]) => Promise<any>>(cb: CB): CB => 
    (async (...args: Parameters<CB>) => {
      if (await this.isPeasant)
        throw new SimpleResponse('Incorrect admin token', 403)
      return cb(...args)
    }) as CB

  adminResetQueue = this.adminHandler(async (): Promise<Q> => this.setQ([]))
  adminSetVotes = this.adminHandler(async (songId: string, votes: number): Promise<Q> => {
    if (typeof votes !== 'number') throw new SimpleResponse('votes must be number', 422)
    const q = await this.getQ()
    const s = await this.getSongInQ(songId, q) // validation that the song exists
    const votess = votes < s.votes.length ? Array(votes).fill(this.votingToken) : [...s.votes, ...Array(votes-s.votes.length).fill(this.votingToken)]
    return this.setVotes({id: songId, votes: votess}, q)
  })
  adminRemoveSongFromQueue = this.adminHandler(async (songId: string): Promise<Q> => {
    const q = await this.getQ()
    return this.setQ(q.filter(s => s.id !== songId))
  })
  adminSetQueue = this.adminHandler(async (q: Q): Promise<Q> => this.setQ(q.map(s => this.validateQItem(s, true))))
  adminSetRequestRateLimit = this.adminHandler(async (mins: number): Promise<void> => this.kv.put(keyRequestRateLimitMins, mins.toString()))
  adminDeleteQueue = this.adminHandler(async (): Promise<void> => this.db.deleteQ())
  adminAuthorize = this.adminHandler(async () => {}) // This method exists purely to validate whether we can show the admin dashboard

  private validateQItem(s: QItem, validateAvailable = false): QItem {
    if (typeof s.id !== 'string' || !s.votes.every(v => v.match(/_/)))
      throw new SimpleResponse('Invalid q item: ' + JSON.stringify(s), 422)
    if (validateAvailable) this.validateSongAvailable(s.id)
    return s
  }
  private validateSongAvailable(id: string) {
    if (!availableSongIds.includes(id))
      throw new SimpleResponse('Song not available: ' + id, 404)
  }

  private async setVotes(updatedSong: QItem, q: Q): Promise<Q> {
    this.validateQItem(updatedSong)
    const withUpdatedVote = (q ?? await this.getQ()).map(s => s.id === updatedSong.id ? updatedSong : s)
    const withUpdatedSort = [withUpdatedVote[0], ...withUpdatedVote.slice(1,2), ...withUpdatedVote.slice(2).sort((a,b) => b.votes.length-a.votes.length)]
    return this.setQ(withUpdatedSort)
  }

  private async getQ(): Promise<Q> {
    const q = await this.db.getQ()
    if (!q) {
      // If we can acknowledge that the queue should exist, create it anew again
      // todo: possibly backup the q from time to time in kv?
      if (await this.kv.get(this.aKey))
        return this.setQ([])
      throw new SimpleResponse("Queue not found", 404)
    }
    return q
  }

  private async getSongInQ(id: string, q?: Q): Promise<QItem> {
    const song = (q ?? await this.getQ()).find(s => s.id === id)
    if (!song)
      throw new SimpleResponse('Song not found in queue', 404)
    return song
  }

  private async setQ(q: Q): Promise<Q> {
    await this.db.putQ(q)
    return q
  }

  private async isAdmin(): Promise<boolean> {
    const expected = await this.kv.get(this.aKey, {cacheTtl: 3600})
    return !!expected && expected === this.userName
  }
  
}
