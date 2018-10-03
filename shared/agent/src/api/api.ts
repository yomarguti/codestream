"use strict";
import fetch, { Headers, RequestInit, Response } from "node-fetch";
import { URLSearchParams } from "url";
import { ServerError } from "../agentError";
import { Logger } from "../logger";
import {
	AccessToken,
	GetLatestPostResponse,
	GetPostsInRangeResponse,
	GetUnreadStreamsResponse
} from "../shared/agent.protocol";
import {
	CompleteSignupRequest,
	CreateMarkerLocationRequest,
	CreateMarkerLocationResponse,
	CreatePostRequest,
	CreatePostResponse,
	CreateRepoRequest,
	CreateRepoResponse,
	CreateStreamRequest,
	CreateStreamResponse,
	CSStream,
	DeletePostResponse,
	DeleteTeamContentRequest,
	DeleteTeamContentResponse,
	EditPostRequest,
	EditPostResponse,
	FindRepoResponse,
	GetMarkerLocationsResponse,
	GetMarkerResponse,
	GetMarkersResponse,
	GetMeResponse,
	GetPostResponse,
	GetPostsResponse,
	GetRepoResponse,
	GetReposResponse,
	GetStreamResponse,
	GetStreamsResponse,
	GetTeamResponse,
	GetTeamsResponse,
	GetUserResponse,
	GetUsersResponse,
	InviteRequest,
	InviteResponse,
	JoinStreamRequest,
	JoinStreamResponse,
	LoginRequest,
	LoginResponse,
	MarkPostUnreadRequest,
	MarkPostUnreadResponse,
	Push,
	Reactions,
	ReactToPostRequest,
	ReactToPostResponse,
	StreamType,
	UpdateMarkerRequest,
	UpdateMarkerResponse,
	UpdatePresenceRequest,
	UpdatePresenceResponse,
	UpdateStreamMembershipRequest,
	UpdateStreamMembershipResponse
} from "../shared/api.protocol";
import { Functions } from "../system/function";
import { Strings } from "../system/string";

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

	createPost(token: string, request: CreatePostRequest): Promise<CreatePostResponse> {
		return this.post<CreatePostRequest, CreatePostResponse>(`/posts`, request, token);
	}

	createRepo(token: string, request: CreateRepoRequest): Promise<CreateRepoResponse> {
		return this.post<CreateRepoRequest, CreateRepoResponse>(`/repos`, request, token);
	}

	createStream(token: string, request: CreateStreamRequest): Promise<CreateStreamResponse> {
		return this.post<CreateStreamRequest, CreateStreamResponse>(`/streams`, request, token);
	}

	deletePost(token: string, teamId: string, postId: string) {
		return this.delete<DeletePostResponse>(`/posts/${postId}`, token);
	}

	deleteStream(token: string, teamId: string, streamId: string) {
		return this.delete<any /*DeleteStreamResponse*/>(`/streams/${streamId}`, token);
	}

	reactToPost(token: string, request: ReactToPostRequest) {
		return this.put<Reactions, ReactToPostResponse>(`/react/${request.id}`, request.emojis, token);
	}

	editPost(token: string, request: EditPostRequest) {
		return this.put<EditPostRequest, EditPostResponse>(`/posts/${request.id}`, request, token);
	}

	markPostUnread(token: string, request: MarkPostUnreadRequest) {
		return this.put<MarkPostUnreadRequest, MarkPostUnreadResponse>(
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
		return this.get<FindRepoResponse>(
			`/no-auth/find-repo?url=${encodeURIComponent(url)}&knownCommitHashes=${firstCommitHashes.join(
				","
			)}&firstCommitHash=${firstCommitHashes[0]}`
		);
	}

	getMarker(token: string, teamId: string, markerId: string): Promise<GetMarkerResponse> {
		return this.get<GetMarkerResponse>(`/markers/${markerId}?teamId=${teamId}`, token);
	}

	getMarkerLocations(
		token: string,
		teamId: string,
		streamId: string,
		commitHash: string
	): Promise<GetMarkerLocationsResponse> {
		return this.get<GetMarkerLocationsResponse>(
			`/marker-locations?teamId=${teamId}&streamId=${streamId}&commitHash=${commitHash}`,
			token
		);
	}

	getMarkers(token: string, teamId: string, streamId: string): Promise<GetMarkersResponse> {
		return this.get<GetMarkersResponse>(`/markers?teamId=${teamId}&streamId=${streamId}`, token);
	}

	getPost(token: string, teamId: string, postId: string): Promise<GetPostResponse> {
		return this.get<GetPostResponse>(`/posts/${postId}?teamId=${teamId}`, token);
	}

	getLatestPost(token: string, teamId: string, streamId: string): Promise<GetLatestPostResponse> {
		return this.get<GetLatestPostResponse>(
			`/posts/?teamId=${teamId}&streamId=${streamId}&limit=1`,
			token
		);
	}

	getPostsInRange(
		token: string,
		teamId: string,
		streamId: string,
		range: string
	): Promise<GetPostsInRangeResponse> {
		return this.get<GetPostsInRangeResponse>(
			`/posts/?teamId=${teamId}&streamId=${streamId}&seqnum=${range}`,
			token
		);
	}

	getPosts(token: string, teamId: string, streamId: string): Promise<GetPostsResponse> {
		return this.get<GetPostsResponse>(`/posts?teamId=${teamId}&streamId=${streamId}`, token);
	}

	getPostsBySequence(
		token: string,
		teamId: string,
		streamId: string,
		minSeq: number,
		maxSeq: number
	): Promise<GetPostsResponse> {
		const teamParam = `teamId=${teamId}`;
		const streamParam = `streamId=${streamId}`;
		const seqParam = `seqnum=${minSeq}-${maxSeq}`;
		return this.get<GetPostsResponse>(`/posts?${teamParam}&${streamParam}&${seqParam}`, token);
	}

	getPostsLesserThan(
		token: string,
		teamId: string,
		streamId: string,
		limit: number,
		lt?: string
	): Promise<GetPostsResponse> {
		const teamParam = `?teamId=${teamId}`;
		const streamParam = `&streamId=${streamId}`;
		const ltParam = lt ? `&lt=${lt}` : "";
		const limitParam = `&limit=${limit}`;
		return this.get<GetPostsResponse>(
			`/posts${teamParam}${streamParam}${ltParam}${limitParam}`,
			token
		);
	}

	getChildPosts(token: string, teamId: string, parentPostId: string): Promise<GetPostsResponse> {
		const teamParam = `?teamId=${teamId}`;
		const parentParam = `?parentPostId=${parentPostId}`;
		return this.get<GetPostsResponse>(`/posts${teamParam}${parentParam}`, token);
	}

	getRepo(token: string, teamId: string, repoId: string): Promise<GetRepoResponse> {
		return this.get<GetRepoResponse>(`/repos/${repoId}`, token);
	}

	getRepos(token: string, teamId: string): Promise<GetReposResponse> {
		return this.get<GetReposResponse>(`/repos?teamId=${teamId}`, token);
	}

	getStream<T extends CSStream>(
		token: string,
		teamId: string,
		streamId: string
	): Promise<GetStreamResponse<T>> {
		return this.get<GetStreamResponse<T>>(`/streams/${streamId}`, token);
	}

	getUnreadStreams<T extends CSStream>(
		token: string,
		teamId: string
	): Promise<GetUnreadStreamsResponse> {
		return this.get<GetUnreadStreamsResponse>(`/streams?teamId=${teamId}&unread`, token);
	}

	getStreams<T extends CSStream>(
		token: string,
		teamId: string,
		repoId?: string
	): Promise<GetStreamsResponse<T>> {
		return this.get<GetStreamsResponse<T>>(
			`/streams?teamId=${teamId}${repoId === undefined ? "" : `&repoId=${repoId}`}`,
			token
		);
	}

	getTeam(token: string, teamId: string): Promise<GetTeamResponse> {
		return this.get<GetTeamResponse>(`/teams/${teamId}`, token);
	}

	getTeams(token: string, teamIds: string[]): Promise<GetTeamsResponse> {
		return this.get<GetTeamsResponse>(`/teams?ids=${teamIds.join(",")}`, token);
	}

	getUser(token: string, teamId: string, userId: string): Promise<GetUserResponse> {
		return this.get<GetUserResponse>(`/users/${userId}`, token);
	}

	getUsers(token: string, teamId: string): Promise<GetUsersResponse> {
		return this.get<GetUsersResponse>(`/users?teamId=${teamId}`, token);
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

	updatePresence(token: string, request: UpdatePresenceRequest) {
		return this.put<UpdatePresenceRequest, UpdatePresenceResponse>(`/presence`, request, token);
	}

	updateStreamMembership(token: string, teamId: string, streamId: string, push: Push) {
		return this.put<Push, UpdateStreamMembershipResponse>(`/streams/${streamId}`, push, token);
	}

	invite(token: string, request: InviteRequest) {
		return this.post<InviteRequest, InviteResponse>("/users", request, token);
	}

	markStreamRead(token: string, streamId: string) {
		return this.put(`/read/${streamId}`, {}, token);
	}

	savePreferences(token: string, preferences: {}) {
		return this.put("/preferences", preferences, token);
	}

	getMe(token: string) {
		return this.get<GetMeResponse>("/users/me", token);
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

export interface CodeStreamApiMiddlewareContext {
	url: string;
	method: string;
	request: RequestInit | undefined;
	response?: Response;
}

export interface CodeStreamApiMiddleware {
	readonly name: string;
	onRequest?(context: Readonly<CodeStreamApiMiddlewareContext>): Promise<void>;
	onProvideResponse?<R>(context: Readonly<CodeStreamApiMiddlewareContext>): Promise<R>;
	onResponse?<R>(
		context: Readonly<CodeStreamApiMiddlewareContext>,
		responseJson: Promise<R> | undefined
	): Promise<void>;
}
