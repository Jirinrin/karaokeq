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
import { handleError, handleResult, parseReqInfoWithParams } from "./reqUtils";
import { Env } from "./types";

export { Db } from './db';

export default {
	async fetch(
		req: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,OPTIONS',
			'Access-Control-Max-Age': '86400',
			'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') ?? '',
		}

		try {
			const reqInfo = await parseReqInfoWithParams(req, '/:domain/*')
			// console.log('Fetch from', JSON.stringify([...req.headers.entries()]), JSON.stringify(reqInfo))
			reqInfo.path = reqInfo.path.replace(/^[^\/]+\//, '') // Remove domain from the path

			const userName = req.headers.get('Q-User-Name')
			const sessionToken = req.headers.get('Q-Session')
			const adminToken = req.headers.get('Q-Admin-Token')

			const baseUrl = 'https://karaokeq.q42.workers.dev'
			// const baseUrl = 'http://localhost:8787'
			const handler = new Handler(env, baseUrl, reqInfo.pathParams.domain, userName, sessionToken, adminToken)
			const result = await handler.handleRequest(reqInfo)

			return handleResult(result, corsHeaders)
		} catch (err) {
			return handleError(err, corsHeaders)
		}
	},
}
