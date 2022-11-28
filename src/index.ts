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
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
			'Access-Control-Max-Age': '86400',
			'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? '',
		}

		try {
			const reqInfo = await parseReqInfoWithParams(request, '/:domain/*')
			reqInfo.path = reqInfo.path.replace(/^[^\/]+\//, '') // Remove domain from the path

			const userName = request.headers.get('Q-User-Name')
			const sessionToken = request.headers.get('Q-Session')

			const handler = new Handler(env, reqInfo.pathParams.domain, userName, sessionToken)
			const result = await handler.handleRequest(reqInfo)

			return handleResult(result, corsHeaders)
		} catch (err) {
			return handleError(err, corsHeaders)
		}
	},
}
