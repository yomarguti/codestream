"use strict";
import fetch, { Headers, RequestInit, Response } from "node-fetch";
import { URLSearchParams } from "url";
import { ServerError } from "../agentError";
import { Logger } from "../logger";
import {
	AccessToken,
	FetchLatestPostResponse,
	FetchPostsByRangeResponse,
	FetchUnreadStreamsResponse
} from "../shared/agent.protocol";
import {
	CompleteSignupRequest,
	CreateMarkerLocationRequest,
	CreateMarkerLocationResponse,
	CSCreatePostRequest,
	CSCreatePostResponse,
	CSCreateRepoRequest,
	CSCreateRepoResponse,
	CSCreateStreamRequest,
	CSCreateStreamResponse,
	CSDeletePostResponse,
	CSEditPostRequest,
	CSEditPostResponse,
	CSFindRepoResponse,
	CSGetMarkerLocationsResponse,
	CSGetMarkerResponse,
	CSGetMarkersResponse,
	CSGetMeResponse,
	CSGetPostResponse,
	CSGetPostsResponse,
	CSGetRepoResponse,
	CSGetReposResponse,
	CSGetStreamResponse,
	CSGetStreamsResponse,
	CSGetTeamResponse,
	CSGetTeamsResponse,
	CSGetUserResponse,
	CSGetUsersResponse,
	CSInviteUserRequest,
	CSInviteUserResponse,
	CSMarkPostUnreadRequest,
	CSMarkPostUnreadResponse,
	CSPush,
	CSReactions,
	CSReactToPostRequest,
	CSReactToPostResponse,
	CSStream,
	CSUpdatePresenceRequest,
	CSUpdatePresenceResponse,
	CSUpdateStreamMembershipRequest,
	CSUpdateStreamMembershipResponse,
	DeleteTeamContentRequest,
	DeleteTeamContentResponse,
	JoinStreamRequest,
	JoinStreamResponse,
	LoginRequest,
	LoginResponse,
	StreamType,
	UpdateMarkerRequest,
	UpdateMarkerResponse
} from "../shared/api.protocol";
import { Functions } from "../system/function";
import { Strings } from "../system/string";
import { CodeStreamApiMiddleware, CodeStreamApiMiddlewareContext } from "./apiProvider";

export { AccessToken } from "../shared/agent.protocol";
export * from "../shared/api.protocol";

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

	login(email: string, passwordOrToken: string | AccessToken): Promise<LoginResponse> {
		if (typeof passwordOrToken === "string") {
			return this.put<LoginRequest, LoginResponse>("/no-auth/login", {
				email: email,
				password: passwordOrToken
			});
		} else {
			return this.put<{}, LoginResponse>("/login", {}, passwordOrToken.value);
		}
	}

	useMiddleware(middleware: CodeStreamApiMiddleware) {
		this._middleware.push(middleware);
		return {
			dispose: () => {
				const i = this._middleware.indexOf(middleware);
				this._middleware.splice(i, 1);
			}
		};
	}

	checkSignup(token: string): Promise<LoginResponse> {
		return this.put<CompleteSignupRequest, LoginResponse>("/no-auth/check-signup", {
			token
		});
	}

	createMarkerLocation(
		token: string,
		request: CreateMarkerLocationRequest
	): Promise<CreateMarkerLocationResponse> {
		return this.put<CreateMarkerLocationRequest, CreateMarkerLocationResponse>(
			`/marker-locations`,
			request,
			token
		);
	}

	createPost(token: string, request: CSCreatePostRequest): Promise<CSCreatePostResponse> {
		return this.post<CSCreatePostRequest, CSCreatePostResponse>(`/posts`, request, token);
	}

	createRepo(token: string, request: CSCreateRepoRequest): Promise<CSCreateRepoResponse> {
		return this.post<CSCreateRepoRequest, CSCreateRepoResponse>(`/repos`, request, token);
	}

	createStream(token: string, request: CSCreateStreamRequest): Promise<CSCreateStreamResponse> {
		return this.post<CSCreateStreamRequest, CSCreateStreamResponse>(`/streams`, request, token);
	}

	deletePost(token: string, teamId: string, postId: string) {
		return this.delete<CSDeletePostResponse>(`/posts/${postId}`, token);
	}

	deleteStream(token: string, teamId: string, streamId: string) {
		return this.delete<any /*DeleteStreamResponse*/>(`/streams/${streamId}`, token);
	}

	reactToPost(token: string, request: CSReactToPostRequest) {
		return this.put<CSReactions, CSReactToPostResponse>(
			`/react/${request.id}`,
			request.emojis,
			token
		);
	}

	editPost(token: string, request: CSEditPostRequest) {
		return this.put<CSEditPostRequest, CSEditPostResponse>(`/posts/${request.id}`, request, token);
	}

	markPostUnread(token: string, request: CSMarkPostUnreadRequest) {
		return this.put<CSMarkPostUnreadRequest, CSMarkPostUnreadResponse>(
			`/unread/${request.id}`,
			request,
			token
		);
	}

	deleteTeamContent(token: string, request: DeleteTeamContentRequest) {
		return this.put<DeleteTeamContentRequest, DeleteTeamContentResponse>(
			`/delete-content`,
			request,
			token
		);
	}

	findRepo(url: string, firstCommitHashes: string[]) {
		return this.get<CSFindRepoResponse>(
			`/no-auth/find-repo?url=${encodeURIComponent(url)}&knownCommitHashes=${firstCommitHashes.join(
				","
			)}&firstCommitHash=${firstCommitHashes[0]}`
		);
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

	getPost(token: string, teamId: string, postId: string): Promise<CSGetPostResponse> {
		return this.get<CSGetPostResponse>(`/posts/${postId}?teamId=${teamId}`, token);
	}

	getLatestPost(token: string, teamId: string, streamId: string): Promise<FetchLatestPostResponse> {
		return this.get<FetchLatestPostResponse>(
			`/posts/?teamId=${teamId}&streamId=${streamId}&limit=1`,
			token
		);
	}

	getPostsInRange(
		token: string,
		teamId: string,
		streamId: string,
		range: string
	): Promise<FetchPostsByRangeResponse> {
		return this.get<FetchPostsByRangeResponse>(
			`/posts/?teamId=${teamId}&streamId=${streamId}&seqnum=${range}`,
			token
		);
	}

	getPosts(token: string, teamId: string, streamId: string): Promise<CSGetPostsResponse> {
		return this.get<CSGetPostsResponse>(`/posts?teamId=${teamId}&streamId=${streamId}`, token);
	}

	getPostsBySequence(
		token: string,
		teamId: string,
		streamId: string,
		minSeq: number,
		maxSeq: number
	): Promise<CSGetPostsResponse> {
		const teamParam = `teamId=${teamId}`;
		const streamParam = `streamId=${streamId}`;
		const seqParam = `seqnum=${minSeq}-${maxSeq}`;
		return this.get<CSGetPostsResponse>(`/posts?${teamParam}&${streamParam}&${seqParam}`, token);
	}

	getPostsLesserThan(
		token: string,
		teamId: string,
		streamId: string,
		limit: number,
		lt?: string
	): Promise<CSGetPostsResponse> {
		const teamParam = `?teamId=${teamId}`;
		const streamParam = `&streamId=${streamId}`;
		const ltParam = lt ? `&lt=${lt}` : "";
		const limitParam = `&limit=${limit}`;
		return this.get<CSGetPostsResponse>(
			`/posts${teamParam}${streamParam}${ltParam}${limitParam}`,
			token
		);
	}

	getChildPosts(token: string, teamId: string, parentPostId: string): Promise<CSGetPostsResponse> {
		const teamParam = `?teamId=${teamId}`;
		const parentParam = `?parentPostId=${parentPostId}`;
		return this.get<CSGetPostsResponse>(`/posts${teamParam}${parentParam}`, token);
	}

	getRepo(token: string, teamId: string, repoId: string): Promise<CSGetRepoResponse> {
		return this.get<CSGetRepoResponse>(`/repos/${repoId}`, token);
	}

	getRepos(token: string, teamId: string): Promise<CSGetReposResponse> {
		return this.get<CSGetReposResponse>(`/repos?teamId=${teamId}`, token);
	}

	getStream<T extends CSStream>(
		token: string,
		teamId: string,
		streamId: string
	): Promise<CSGetStreamResponse<T>> {
		return this.get<CSGetStreamResponse<T>>(`/streams/${streamId}`, token);
	}

	getUnreadStreams<T extends CSStream>(
		token: string,
		teamId: string
	): Promise<FetchUnreadStreamsResponse> {
		return this.get<FetchUnreadStreamsResponse>(`/streams?teamId=${teamId}&unread`, token);
	}

	async getStreams<T extends CSStream>(
		token: string,
		teamId: string,
		types?: (StreamType.Channel | StreamType.Direct)[],
		repoId?: string
	): Promise<CSGetStreamsResponse<T>> {
		const response = await this.get<CSGetStreamsResponse<T>>(
			`/streams?teamId=${teamId}${repoId === undefined ? "" : `&repoId=${repoId}`}`,
			token
		);
		if (types) {
			return {
				...response,
				streams: response.streams.filter(s =>
					types.includes(s.type as StreamType.Channel | StreamType.Direct)
				)
			};
		}

		return response;
	}

	getTeam(token: string, teamId: string): Promise<CSGetTeamResponse> {
		return this.get<CSGetTeamResponse>(`/teams/${teamId}`, token);
	}

	getTeams(token: string, teamIds: string[]): Promise<CSGetTeamsResponse> {
		return this.get<CSGetTeamsResponse>(`/teams?ids=${teamIds.join(",")}`, token);
	}

	getUser(token: string, teamId: string, userId: string): Promise<CSGetUserResponse> {
		return this.get<CSGetUserResponse>(`/users/${userId}`, token);
	}

	getUsers(token: string, teamId: string): Promise<CSGetUsersResponse> {
		return this.get<CSGetUsersResponse>(`/users?teamId=${teamId}`, token);
	}

	joinStream(token: string, teamId: string, streamId: string) {
		return this.put<{}, JoinStreamResponse>(`/join/${streamId}`, {}, token);
	}

	updateStream(token: string, streamId: string, changes: { [key: string]: any }) {
		return this.put(`/streams/${streamId}`, changes, token);
	}

	updateMarker(token: string, markerId: string, request: UpdateMarkerRequest) {
		return this.put<UpdateMarkerRequest, UpdateMarkerResponse>(
			`/markers/${markerId}`,
			request,
			token
		);
	}

	updatePresence(token: string, request: CSUpdatePresenceRequest) {
		return this.put<CSUpdatePresenceRequest, CSUpdatePresenceResponse>(`/presence`, request, token);
	}

	updateStreamMembership(token: string, teamId: string, streamId: string, push: CSPush) {
		return this.put<CSPush, CSUpdateStreamMembershipResponse>(`/streams/${streamId}`, push, token);
	}

	invite(token: string, request: CSInviteUserRequest) {
		return this.post<CSInviteUserRequest, CSInviteUserResponse>("/users", request, token);
	}

	markStreamRead(token: string, streamId: string) {
		return this.put(`/read/${streamId}`, {}, token);
	}

	savePreferences(token: string, preferences: {}) {
		return this.put("/preferences", preferences, token);
	}

	getMe(token: string) {
		return this.get<CSGetMeResponse>("/users/me", token);
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
