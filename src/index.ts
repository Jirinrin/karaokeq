/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import Handler from "./handler";
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
			
		try {
			const reqMethod = request.method as Method
			const reqBody = request.body ? await request.json() : undefined
			const userName = request.headers.get('Q-User-Name')
			const sessionToken = request.headers.get('Q-Session')

			const handler = new Handler(env, domain, userName, sessionToken)
			const result = await handler.handleRequest(reqMethod, reqPath, reqBody)
			const resultStr: string = typeof result === 'object' ? JSON.stringify(result) : result && `${result}`
			return new Response(resultStr)
		} catch (err) {
			if (err instanceof Response) {
				console.warn('Expected error', err)
				return err
			} else {
				console.error('Internal error', err)
				return new Response(`${err}`, {status: 500})
			}
		}
	},
}
