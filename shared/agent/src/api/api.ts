"use strict";
import fetch, { Headers, RequestInit, Response } from "node-fetch";
import { URLSearchParams } from "url";
import { ServerError } from "../agentError";
import { Logger } from "../logger";
import {
	CSCreateMarkerLocationRequest,
	CSCreateMarkerLocationResponse,
	CSCreatePostRequest,
	CSCreatePostResponse,
	CSGetMarkerLocationsResponse,
	CSGetMarkerResponse,
	CSGetMarkersResponse,
	CSStream,
	CSUpdateMarkerRequest,
	CSUpdateMarkerResponse,
	StreamType
} from "../shared/api.protocol";
import { Functions } from "../system/function";
import { Strings } from "../system/string";
import { CodeStreamApiMiddleware, CodeStreamApiMiddlewareContext } from "./apiProvider";

export class CodeStreamApi {
	private readonly _middleware: CodeStreamApiMiddleware[] = [];
	// private responseCache = new Map<string, Promise<any>>();

	constructor(
		baseUrl: string,
		private readonly _ideVersion: string,
		private readonly _extensionVersion: string,
		private readonly _extensionBuild: string
	) {
		this._baseUrl = baseUrl;
	}

	private _baseUrl: string;
	get baseUrl() {
		return this._baseUrl;
	}
	set baseUrl(value: string) {
		// TODO: Might need some checks here
		this._baseUrl = value;
	}

	createMarkerLocation(
		token: string,
		request: CSCreateMarkerLocationRequest
	): Promise<CSCreateMarkerLocationResponse> {
		return this.put<CSCreateMarkerLocationRequest, CSCreateMarkerLocationResponse>(
			`/marker-locations`,
			request,
			token
		);
	}

	createPost(token: string, request: CSCreatePostRequest): Promise<CSCreatePostResponse> {
		return this.post<CSCreatePostRequest, CSCreatePostResponse>(`/posts`, request, token);
	}

	getMarker(token: string, teamId: string, markerId: string): Promise<CSGetMarkerResponse> {
		return this.get<CSGetMarkerResponse>(`/markers/${markerId}?teamId=${teamId}`, token);
	}

	getMarkerLocations(
		token: string,
		teamId: string,
		streamId: string,
		commitHash: string
	): Promise<CSGetMarkerLocationsResponse> {
		return this.get<CSGetMarkerLocationsResponse>(
			`/marker-locations?teamId=${teamId}&streamId=${streamId}&commitHash=${commitHash}`,
			token
		);
	}

	getMarkers(token: string, teamId: string, streamId: string): Promise<CSGetMarkersResponse> {
		return this.get<CSGetMarkersResponse>(`/markers?teamId=${teamId}&streamId=${streamId}`, token);
	}

	updateMarker(token: string, markerId: string, request: CSUpdateMarkerRequest) {
		return this.put<CSUpdateMarkerRequest, CSUpdateMarkerResponse>(
			`/markers/${markerId}`,
			request,
			token
		);
	}

	grant(token: string, channel: string): Promise<any> {
		return this.put(`/grant/${channel}`, {}, token);
	}

	private delete<R extends object>(url: string, token?: string): Promise<R> {
		let resp = undefined;
		if (resp === undefined) {
			resp = this.fetch<R>(url, { method: "DELETE" }, token) as Promise<R>;
		}
		return resp;
	}

	private get<R extends object>(url: string, token?: string): Promise<R> {
		return this.fetch<R>(url, { method: "GET" }, token) as Promise<R>;
	}

	private post<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		token?: string
	): Promise<R> {
		return this.fetch<R>(
			url,
			{
				method: "POST",
				body: JSON.stringify(body)
			},
			token
		);
	}

	private put<RQ extends object, R extends object>(
		url: string,
		body: RQ,
		token?: string
	): Promise<R> {
		return this.fetch<R>(
			url,
			{
				method: "PUT",
				body: JSON.stringify(body)
			},
			token
		);
	}

	/*private*/ async fetch<R extends object>(
		url: string,
		init?: RequestInit,
		token?: string
	): Promise<R> {
		const start = process.hrtime();

		let traceResult;
		try {
			if (init !== undefined || token !== undefined) {
				if (init === undefined) {
					init = {};
				}

				if (init.headers === undefined) {
					init.headers = new Headers();
				}

				if (init.headers instanceof Headers) {
					init.headers.append("Accept", "application/json");
					init.headers.append("Content-Type", "application/json");

					if (token !== undefined) {
						init.headers.append("Authorization", `Bearer ${token}`);
					}

					init.headers.append("X-CS-Plugin-IDE", "VS Code");
					init.headers.append(
						"X-CS-Plugin-Version",
						`${this._extensionVersion}-${this._extensionBuild}`
					);
					init.headers.append("X-CS-IDE-Version", this._ideVersion);
				}
			}

			const method = (init && init.method) || "GET";
			const absoluteUrl = `${this.baseUrl}${url}`;

			const context =
				this._middleware.length > 0
					? ({
							url: absoluteUrl,
							method: method,
							request: init
					  } as CodeStreamApiMiddlewareContext)
					: undefined;

			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onRequest === undefined) continue;

					try {
						await mw.onRequest(context);
					} catch (ex) {
						Logger.error(ex, `API: ${method} ${url}: Middleware(${mw.name}).onRequest FAILED`);
					}
				}
			}

			let json: Promise<R> | undefined;
			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onProvideResponse === undefined) continue;

					try {
						json = mw.onProvideResponse(context!);
						if (json !== undefined) break;
					} catch (ex) {
						Logger.error(
							ex,
							`API: ${method} ${url}: Middleware(${mw.name}).onProvideResponse FAILED`
						);
					}
				}
			}

			let resp;
			let retryCount = 0;
			if (json === undefined) {
				[resp, retryCount] = await this.fetchCore(0, absoluteUrl, init);
				if (context !== undefined) {
					context.response = resp;
				}

				if (resp.ok) {
					traceResult = `API: Completed ${method} ${url}`;
					json = resp.json() as Promise<R>;
				}
			}

			if (context !== undefined) {
				for (const mw of this._middleware) {
					if (mw.onResponse === undefined) continue;

					try {
						await mw.onResponse(context!, json);
					} catch (ex) {
						Logger.error(ex, `API: ${method} ${url}: Middleware(${mw.name}).onResponse FAILED`);
					}
				}
			}

			if (resp !== undefined && !resp.ok) {
				traceResult = `API: FAILED(${retryCount}x) ${method} ${url}`;
				throw await this.handleErrorResponse(resp);
			}

			return CodeStreamApi.normalizeResponse(await json!);
		} finally {
			Logger.log(
				`${traceResult}${
					init && init.body ? ` body=${CodeStreamApi.sanitize(init && init.body)}` : ""
				} \u2022 ${Strings.getDurationMilliseconds(start)} ms`
			);
		}
	}

	private async fetchCore(
		count: number,
		url: string,
		init?: RequestInit
	): Promise<[Response, number]> {
		try {
			const resp = await fetch(url, init);
			if (resp.status !== 200) {
				if (resp.status < 400 || resp.status >= 500) {
					count++;
					if (count <= 3) {
						await Functions.wait(250 * count);
						return this.fetchCore(count, url, init);
					}
				}
			}
			return [resp, count];
		} catch (ex) {
			debugger;
			Logger.error(ex);

			count++;
			if (count <= 3) {
				await Functions.wait(250 * count);
				return this.fetchCore(count, url, init);
			}

			throw ex;
		}
	}

	private async handleErrorResponse(response: Response): Promise<Error> {
		let message = response.statusText;
		let data;
		if (response.status >= 400 && response.status < 500) {
			try {
				data = await response.json();
				if (data.code) {
					message += `(${data.code})`;
				}
				if (data.message) {
					message += `: ${data.message}`;
				}
				if (data.info && data.info.name) {
					message += `\n${data.info.name}`;
				}
			} catch {}
		}
		return new ServerError(message, data, response.status);
	}

	static isStreamSubscriptionRequired(stream: CSStream, userId: string): boolean {
		if (stream.deactivated || stream.type === StreamType.File) return false;
		if (stream.type === StreamType.Channel) {
			if (stream.memberIds === undefined) return false;
			if (!stream.memberIds.includes(userId)) return false;
		}
		return true;
	}

	static normalizeResponse<R extends object>(obj: { [key: string]: any }): R {
		// FIXME maybe the api server should never return arrays with null elements?
		if (obj != null) {
			for (const [key, value] of Object.entries(obj)) {
				if (key === "_id") {
					obj["id"] = value;
				}

				if (Array.isArray(value)) {
					obj[key] = value.map(v => this.normalizeResponse(v));
				} else if (typeof value === "object") {
					obj[key] = this.normalizeResponse(value);
				}
			}
		}

		return obj as R;
	}

	static sanitize(
		body:
			| string
			| ArrayBuffer
			| ArrayBufferView
			| NodeJS.ReadableStream
			| URLSearchParams
			| undefined
	) {
		if (body === undefined || typeof body !== "string") return "";

		return body
			.replace(/("password":)".*?"/gi, '$1"<hidden>"')
			.replace(/("token":)".*?"/gi, '$1"<hidden>"');
	}
}
