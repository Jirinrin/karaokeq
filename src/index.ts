/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import Handler, { SimpleResponse } from "./handler";
import { Env, Method } from "./types";

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url)
		const [match, domain, reqPath] = url.pathname.match(/\/([^\/]+)\/([^\/]+)/) ?? []
		if (!match)
			return new Response("Invalid request: path must look like e.g. /:domain/:path", {status: 400})

		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
			'Access-Control-Max-Age': '86400',
			'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? '',
		};

		try {
			const reqMethod = request.method as Method
			// console.log('ya', request.body.)
			const reqBody = request.body && reqMethod !== 'OPTIONS' ? await request.json() : undefined
			const userName = request.headers.get('Q-User-Name')
			const sessionToken = request.headers.get('Q-Session')

			const handler = new Handler(env, domain, userName, sessionToken)
			const result = await handler.handleRequest(reqMethod, reqPath, reqBody)
			const resultStr: string = typeof result === 'object' ? JSON.stringify(result) : result && `${result}`
			
			return new Response(resultStr, {headers: {...corsHeaders}})
		} catch (err) {
			if (err instanceof SimpleResponse) {
				console.warn('Expected error', err.message)
				// todo: it seems as if at this point err.text() or err.json() etc. has already been used? Maybe for the instanceof assessment...?
				return err.withHeaders(corsHeaders)
			} else {
				console.error('Internal error', err)
				return new SimpleResponse(`${err}`, 500, {headers: corsHeaders})
			}
		}
	},
}
